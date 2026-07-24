// @vitest-environment node

import {
  getPayload,
  type Payload,
  type PayloadRequest,
  type RequiredDataFromCollectionSlug,
} from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { createMunicipalityUpdateRecord } from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import { MunicipalityUpdate } from '@/collections/MunicipalityUpdate'
import { municipalityUpdateCreateSchema } from '@/lib/schemas/municipalityUpdate'
import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import {
  getTestTransactionBackendPID,
  waitForAdvisoryLockWaiter,
} from '../helpers/testDatabaseLease'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { stub } from '../helpers/stub'

/** Create data with server-managed fields (e.g. `author`) intentionally omitted. */
type MunicipalityUpdateCreateData = RequiredDataFromCollectionSlug<'municipalityUpdate'>

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

// Builds the Contact → Leadership graph that controls update visibility and authorship.
const createUpdateAccessLeadershipGraph = async (
  coordinator: CampaignUser,
  leader: CampaignUser,
  municipality: number,
  supportStatus: 'engajado' | 'a_abordar',
) => {
  const contact = await campaignFixtures().createContact({
    name: campaignFixtures().value('Liderança atualização'),
  })
  return campaignFixtures().createLeadership({
    contact,
    municipalities: [municipality],
    user: leader,
    supportStatus,
    createdBy: coordinator,
  })
}

const listMunicipalityUpdates = (user: CampaignUser, municipalityID: number) =>
  payload.find({
    collection: 'municipalityUpdate',
    where: { municipality: { equals: municipalityID } },
    depth: 0,
    pagination: false,
    sort: '-createdAt',
    user,
    overrideAccess: false,
  })

describe('campaign municipality update domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('requires weekly answers and requires body for urgent notes', () => {
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        kind: 'semanal',
        worked: 'Mobilização na feira',
        failed: 'Chuva forte',
        needs: 'Material impresso',
      }).success,
    ).toBe(true)
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        kind: 'semanal',
        worked: 'Mobilização na feira',
      }).success,
    ).toBe(false)
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        kind: 'urgente',
        body: 'Precisamos responder hoje.',
      }).success,
    ).toBe(true)
    expect(
      municipalityUpdateCreateSchema.safeParse({
        municipality: 1,
        kind: 'nota',
        body: '   ',
      }).success,
    ).toBe(false)
  })

  it('strips forged author and timestamps from input', () => {
    const parsed = municipalityUpdateCreateSchema.parse({
      municipality: 1,
      kind: 'nota',
      body: 'Registro de campo',
      author: 999,
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
    })

    expect(parsed).toEqual({
      municipality: 1,
      kind: 'nota',
      body: 'Registro de campo',
    })
  })

  it('enforces kind validation through the Local API', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()

    await expect(
      payload.create({
        collection: 'municipalityUpdate',
        data: stub<MunicipalityUpdateCreateData>({
          municipality: municipality.id,
          kind: 'semanal',
          worked: 'Somente uma resposta',
        }),
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow('não funcionou')
    await expect(
      payload.create({
        collection: 'municipalityUpdate',
        data: stub<MunicipalityUpdateCreateData>({
          municipality: municipality.id,
          kind: 'urgente',
          body: '   ',
        }),
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow('texto')
  })

  it('declares immutable app records and server-managed authorship', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const updateAccess =
      typeof MunicipalityUpdate.access?.update === 'function'
        ? await MunicipalityUpdate.access.update({
            id: 1,
            data: undefined,
            req: stub<PayloadRequest>({ user: coordinator }),
          })
        : MunicipalityUpdate.access?.update
    const deleteAccess =
      typeof MunicipalityUpdate.access?.delete === 'function'
        ? await MunicipalityUpdate.access.delete({
            id: 1,
            data: undefined,
            req: stub<PayloadRequest>({ user: coordinator }),
          })
        : MunicipalityUpdate.access?.delete

    expect(updateAccess).toBe(false)
    expect(deleteAccess).toBe(false)
    expect(MunicipalityUpdate.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'author', relationTo: 'campaignUser', required: true }),
      ]),
    )
  })

  it('lets the coordinator create and read every update', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    // Forged `author` goes through a widened variable: the schema must strip it.
    const forgedInput = {
      municipality: municipality.id,
      kind: 'semanal' as const,
      worked: 'Visitas concluídas',
      failed: 'Dois endereços fechados',
      needs: 'Mais panfletos',
      activeVolunteers: 7,
      newSupports: 12,
      author: 999,
    }
    const created = await createMunicipalityUpdateRecord(payload, coordinator, forgedInput)

    expect(created.author).toBe(coordinator.id)
    const visible = await listMunicipalityUpdates(coordinator, municipality.id)
    expect(visible.docs.map(({ id }) => id)).toContain(created.id)
  })

  it('limits advisors to administered municipalities for create and read', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const otherAdvisor = await campaignFixtures().createCampaignUser('advisor')
    const assigned = await campaignFixtures().getMunicipality()
    const other = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(assigned, [advisor])
    await campaignFixtures().assignMunicipalityAdvisors(other, [otherAdvisor])

    const created = await createMunicipalityUpdateRecord(payload, advisor, {
      municipality: assigned.id,
      kind: 'nota',
      body: 'Atualização permitida',
    })
    expect((await listMunicipalityUpdates(advisor, assigned.id)).docs).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })]),
    )
    await expect(
      createMunicipalityUpdateRecord(payload, advisor, {
        municipality: other.id,
        kind: 'nota',
        body: 'Atualização fora do escopo',
      }),
    ).rejects.toThrow()

    await createMunicipalityUpdateRecord(payload, otherAdvisor, {
      municipality: other.id,
      kind: 'nota',
      body: 'Atualização alheia',
    })
    const foreign = await listMunicipalityUpdates(advisor, other.id)
    expect(foreign.docs).toHaveLength(0)
  })

  it('denies leaders from creating municipality updates', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const leader = await campaignFixtures().createCampaignUser('leader')
    const municipality = await campaignFixtures().getMunicipality()
    await createUpdateAccessLeadershipGraph(coordinator, leader, municipality.id, 'engajado')

    await expect(
      createMunicipalityUpdateRecord(payload, leader, {
        municipality: municipality.id,
        kind: 'urgente',
        body: 'Pedido da própria liderança',
      }),
    ).rejects.toThrow()
  })

  it('denies leaders read access to municipality updates', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const leader = await campaignFixtures().createCampaignUser('leader')
    const municipality = await campaignFixtures().getMunicipality()
    await createUpdateAccessLeadershipGraph(coordinator, leader, municipality.id, 'engajado')

    const created = await createMunicipalityUpdateRecord(payload, coordinator, {
      municipality: municipality.id,
      kind: 'nota',
      body: 'Registro do staff',
    })

    await expect(
      payload.findByID({
        collection: 'municipalityUpdate',
        id: created.id,
        depth: 0,
        user: leader,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão/i)

    await expect(listMunicipalityUpdates(leader, municipality.id)).rejects.toThrow(/permissão/i)
  })

  it('denies unlinked leader creation', async () => {
    const unlinked = await campaignFixtures().createCampaignUser('leader')
    const municipality = await campaignFixtures().getMunicipality()

    await expect(
      createMunicipalityUpdateRecord(payload, unlinked, {
        municipality: municipality.id,
        kind: 'nota',
        body: 'Sem vínculo',
      }),
    ).rejects.toThrow()
  })

  it('denies anonymous create and read operations', async () => {
    const municipality = await campaignFixtures().getMunicipality()

    await expect(
      payload.create({
        collection: 'municipalityUpdate',
        data: stub<MunicipalityUpdateCreateData>({
          municipality: municipality.id,
          kind: 'nota',
          body: 'Tentativa anônima',
        }),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.find({
        collection: 'municipalityUpdate',
        depth: 0,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('denies actual Local API update and delete operations for every campaign role', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const leader = await campaignFixtures().createCampaignUser('leader')
    const municipality = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(municipality, [advisor])
    await createUpdateAccessLeadershipGraph(coordinator, leader, municipality.id, 'engajado')
    const created = await createMunicipalityUpdateRecord(payload, coordinator, {
      municipality: municipality.id,
      kind: 'nota',
      body: 'Registro imutável',
    })

    for (const actor of [coordinator, advisor, leader]) {
      await expect(
        payload.update({
          collection: 'municipalityUpdate',
          id: created.id,
          data: { body: 'Tentativa de edição' },
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      await expect(
        payload.delete({
          collection: 'municipalityUpdate',
          id: created.id,
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    }
  })

  it('recomputes the latest timestamp after deterministic concurrent creates', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createMunicipalityUpdateRecord(payload, coordinator, {
          municipality: municipality.id,
          kind: 'nota',
          body: `Registro concorrente ${index}`,
        }),
      ),
    )
    const latestCreatedAt = created
      .map(({ createdAt }) => createdAt)
      .sort((left, right) => right.localeCompare(left))[0]

    const persistedMunicipality = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
    })
    expect(persistedMunicipality.lastUpdateAt).toBe(latestCreatedAt)
  })

  it('waits on the exact municipality-updates namespace before recomputing derived state', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const holderID = await payload.db.beginTransaction()
    if (holderID === null) throw new Error('Expected a PostgreSQL transaction.')
    await acquireTextAdvisoryLocks(payload, { transactionID: holderID }, [
      `municipality-updates:${municipality.id}`,
    ])

    const originalBegin = payload.db.beginTransaction.bind(payload.db)
    let resolveWaiterPID!: (pid: number) => void
    const waiterPID = new Promise<number>((resolve) => {
      resolveWaiterPID = resolve
    })
    const beginSpy = vi.spyOn(payload.db, 'beginTransaction').mockImplementation(async () => {
      const transactionID = await originalBegin()
      if (transactionID === null) throw new Error('Expected update transaction.')
      resolveWaiterPID(await getTestTransactionBackendPID(payload, transactionID))
      return transactionID
    })
    const pending = createMunicipalityUpdateRecord(payload, coordinator, {
      municipality: municipality.id,
      kind: 'nota',
      body: 'Registro bloqueado até a liberação',
    })

    try {
      const expectedPID = await waiterPID
      await expect(
        waitForAdvisoryLockWaiter(payload, {
          key: `municipality-updates:${municipality.id}`,
          mode: 'ExclusiveLock',
          waiterPID: expectedPID,
        }),
      ).resolves.toMatchObject({ granted: false, pid: expectedPID })
      await payload.db.rollbackTransaction(holderID)
      const created = await pending
      await expect(
        payload.findByID({ collection: 'municipality', id: municipality.id, depth: 0 }),
      ).resolves.toMatchObject({ lastUpdateAt: created.createdAt })
    } catch (error) {
      await payload.db.rollbackTransaction(holderID).catch(() => undefined)
      throw error
    } finally {
      beginSpy.mockRestore()
    }
  })

  it('recomputes after deterministic concurrent deletes of the latest records', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const created = []
    for (let index = 0; index < 4; index += 1) {
      created.push(
        await createMunicipalityUpdateRecord(payload, coordinator, {
          municipality: municipality.id,
          kind: 'nota',
          body: `Registro para exclusão concorrente ${index}`,
        }),
      )
    }
    const [latest, secondLatest, expectedLatest] = created.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )

    await Promise.all([
      payload.delete({
        collection: 'municipalityUpdate',
        id: latest.id,
        depth: 0,
      }),
      payload.delete({
        collection: 'municipalityUpdate',
        id: secondLatest.id,
        depth: 0,
      }),
    ])

    const persistedMunicipality = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
    })
    expect(persistedMunicipality.lastUpdateAt).toBe(expectedLatest.createdAt)
  })

  it('recomputes both municipalities after an admin reassigns an update', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const oldMunicipality = await campaignFixtures().getMunicipality()
    const newMunicipality = await campaignFixtures().getMunicipality()
    const oldRemaining = await createMunicipalityUpdateRecord(payload, coordinator, {
      municipality: oldMunicipality.id,
      kind: 'nota',
      body: 'Permanece na Praça original',
    })
    const moved = await createMunicipalityUpdateRecord(payload, coordinator, {
      municipality: oldMunicipality.id,
      kind: 'nota',
      body: 'Será transferido',
    })

    await payload.update({
      collection: 'municipalityUpdate',
      id: moved.id,
      data: { municipality: newMunicipality.id },
      depth: 0,
    })

    const [persistedOld, persistedNew] = await Promise.all([
      payload.findByID({
        collection: 'municipality',
        id: oldMunicipality.id,
        depth: 0,
      }),
      payload.findByID({
        collection: 'municipality',
        id: newMunicipality.id,
        depth: 0,
      }),
    ])
    expect(persistedOld.lastUpdateAt).toBe(oldRemaining.createdAt)
    expect(persistedNew.lastUpdateAt).toBe(moved.createdAt)
  })

  it('updates lastUpdateAt on create and recomputes it after admin deletion', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const first = await createMunicipalityUpdateRecord(payload, coordinator, {
      municipality: municipality.id,
      kind: 'nota',
      body: 'Primeiro registro',
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await createMunicipalityUpdateRecord(payload, coordinator, {
      municipality: municipality.id,
      kind: 'nota',
      body: 'Segundo registro',
    })

    const afterCreate = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
    })
    expect(afterCreate.lastUpdateAt).toBe(second.createdAt)

    await payload.delete({
      collection: 'municipalityUpdate',
      id: second.id,
      depth: 0,
    })
    const afterLatestDelete = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
    })
    expect(afterLatestDelete.lastUpdateAt).toBe(first.createdAt)

    await payload.delete({
      collection: 'municipalityUpdate',
      id: first.id,
      depth: 0,
    })
    const afterAllDelete = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
    })
    expect(afterAllDelete.lastUpdateAt).toBeNull()
  })

  it('rolls back the update record when the derived municipality write fails', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const originalUpdate = payload.update.bind(payload)
    const updateSpy = vi.spyOn(payload, 'update').mockImplementation(async (args) => {
      if (
        args.collection === 'municipality' &&
        args.data &&
        'lastUpdateAt' in args.data &&
        args.data.lastUpdateAt
      ) {
        throw new Error('falha forçada no campo derivado')
      }
      return originalUpdate(args)
    })

    try {
      await expect(
        createMunicipalityUpdateRecord(payload, coordinator, {
          municipality: municipality.id,
          kind: 'nota',
          body: 'Este registro deve reverter',
        }),
      ).rejects.toThrow('falha forçada')
    } finally {
      updateSpy.mockRestore()
    }

    const persisted = await payload.find({
      collection: 'municipalityUpdate',
      where: { municipality: { equals: municipality.id } },
      depth: 0,
      pagination: false,
    })
    expect(persisted.totalDocs).toBe(0)
  })
})
