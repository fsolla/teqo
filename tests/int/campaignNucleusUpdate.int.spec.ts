// @vitest-environment node

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import {
  createNucleusUpdateRecord,
  listNucleusUpdates,
} from '@/app/(campaign)/campanha/actions/nucleusUpdate'
import { NucleusUpdate } from '@/collections/NucleusUpdate'
import { nucleusUpdateCreateSchema } from '@/lib/schemas/nucleusUpdate'
import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import {
  getTestTransactionBackendPID,
  waitForAdvisoryLockWaiter,
} from '../helpers/testDatabaseLease'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

// Builds the Contact → Leadership graph that controls update visibility and authorship.
const createUpdateAccessLeadershipGraph = async (
  general: CampaignUser,
  leader: CampaignUser,
  nucleus: number,
  supportStatus: 'engajado' | 'a_abordar',
) => {
  const contact = await campaignFixtures().createContact({
    name: campaignFixtures().value('Liderança atualização'),
  })
  return campaignFixtures().createLeadership({
    contact,
    nucleus,
    user: leader,
    supportStatus,
    createdBy: general,
  })
}

describe('campaign nucleus update domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('requires weekly answers and requires body for urgent notes', () => {
    expect(
      nucleusUpdateCreateSchema.safeParse({
        nucleus: 1,
        kind: 'semanal',
        worked: 'Mobilização na feira',
        failed: 'Chuva forte',
        needs: 'Material impresso',
      }).success,
    ).toBe(true)
    expect(
      nucleusUpdateCreateSchema.safeParse({
        nucleus: 1,
        kind: 'semanal',
        worked: 'Mobilização na feira',
      }).success,
    ).toBe(false)
    expect(
      nucleusUpdateCreateSchema.safeParse({
        nucleus: 1,
        kind: 'urgente',
        body: 'Precisamos responder hoje.',
      }).success,
    ).toBe(true)
    expect(
      nucleusUpdateCreateSchema.safeParse({
        nucleus: 1,
        kind: 'nota',
        body: '   ',
      }).success,
    ).toBe(false)
  })

  it('strips forged author and timestamps from input', () => {
    const parsed = nucleusUpdateCreateSchema.parse({
      nucleus: 1,
      kind: 'nota',
      body: 'Registro de campo',
      author: 999,
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
    } as never)

    expect(parsed).toEqual({
      nucleus: 1,
      kind: 'nota',
      body: 'Registro de campo',
    })
  })

  it('enforces kind validation through the Local API', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()

    await expect(
      payload.create({
        collection: 'nucleusUpdate',
        data: {
          nucleus: nucleus.id,
          kind: 'semanal',
          worked: 'Somente uma resposta',
        } as never,
        user: general,
        overrideAccess: false,
      }),
    ).rejects.toThrow('não funcionou')
    await expect(
      payload.create({
        collection: 'nucleusUpdate',
        data: {
          nucleus: nucleus.id,
          kind: 'urgente',
          body: '   ',
        } as never,
        user: general,
        overrideAccess: false,
      }),
    ).rejects.toThrow('texto')
  })

  it('declares immutable app records and server-managed authorship', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const updateAccess =
      typeof NucleusUpdate.access?.update === 'function'
        ? await NucleusUpdate.access.update({
            id: 1,
            data: undefined,
            req: { user: general } as never,
          })
        : NucleusUpdate.access?.update
    const deleteAccess =
      typeof NucleusUpdate.access?.delete === 'function'
        ? await NucleusUpdate.access.delete({
            id: 1,
            data: undefined,
            req: { user: general } as never,
          })
        : NucleusUpdate.access?.delete

    expect(updateAccess).toBe(false)
    expect(deleteAccess).toBe(false)
    expect(NucleusUpdate.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'author', relationTo: 'campaignUser', required: true }),
      ]),
    )
  })

  it('lets general coordination create and read every update', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const created = await createNucleusUpdateRecord(payload, general, {
      nucleus: nucleus.id,
      kind: 'semanal',
      worked: 'Visitas concluídas',
      failed: 'Dois endereços fechados',
      needs: 'Mais panfletos',
      activeVolunteers: 7,
      newSupports: 12,
      author: 999,
    } as never)

    expect(created.author).toBe(general.id)
    const visible = await listNucleusUpdates(payload, general, nucleus.id)
    expect(visible.docs.map(({ id }) => id)).toContain(created.id)
  })

  it('limits coordinators to assigned nuclei for create and read', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const otherCoordinator = await campaignFixtures().createCampaignUser('coordenador')
    const assigned = await campaignFixtures().createNucleus({ coordinators: [coordinator.id] })
    const other = await campaignFixtures().createNucleus({ coordinators: [otherCoordinator.id] })

    const created = await createNucleusUpdateRecord(payload, coordinator, {
      nucleus: assigned.id,
      kind: 'nota',
      body: 'Atualização permitida',
    })
    expect((await listNucleusUpdates(payload, coordinator, assigned.id)).docs).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })]),
    )
    await expect(
      createNucleusUpdateRecord(payload, coordinator, {
        nucleus: other.id,
        kind: 'nota',
        body: 'Atualização fora do escopo',
      }),
    ).rejects.toThrow()
    await expect(listNucleusUpdates(payload, coordinator, other.id)).rejects.toThrow()
  })

  it('lets engaged leadership create and read only its authored updates', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leader = await campaignFixtures().createCampaignUser('lideranca')
    const otherLeader = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    await createUpdateAccessLeadershipGraph(general, leader, nucleus.id, 'engajado')
    await createUpdateAccessLeadershipGraph(general, otherLeader, nucleus.id, 'engajado')

    const own = await createNucleusUpdateRecord(payload, leader, {
      nucleus: nucleus.id,
      kind: 'urgente',
      body: 'Pedido da própria liderança',
    })
    await createNucleusUpdateRecord(payload, otherLeader, {
      nucleus: nucleus.id,
      kind: 'nota',
      body: 'Registro de outra liderança',
    })

    const visible = await listNucleusUpdates(payload, leader, nucleus.id)
    expect(visible.docs.map(({ id }) => id)).toEqual([own.id])
  })

  it('denies unlinked and non-engaged leadership creation', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const unlinked = await campaignFixtures().createCampaignUser('lideranca')
    const inactive = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    await createUpdateAccessLeadershipGraph(general, inactive, nucleus.id, 'a_abordar')

    for (const actor of [unlinked, inactive]) {
      await expect(
        createNucleusUpdateRecord(payload, actor, {
          nucleus: nucleus.id,
          kind: 'nota',
          body: 'Sem vínculo engajado',
        }),
      ).rejects.toThrow()
    }
  })

  it('denies anonymous create and read operations', async () => {
    const nucleus = await campaignFixtures().createNucleus()

    await expect(
      payload.create({
        collection: 'nucleusUpdate',
        data: {
          nucleus: nucleus.id,
          kind: 'nota',
          body: 'Tentativa anônima',
        } as never,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.find({
        collection: 'nucleusUpdate',
        depth: 0,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('denies actual Local API update and delete operations for every campaign role', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const leader = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus({ coordinators: [coordinator.id] })
    await createUpdateAccessLeadershipGraph(general, leader, nucleus.id, 'engajado')
    const created = await createNucleusUpdateRecord(payload, general, {
      nucleus: nucleus.id,
      kind: 'nota',
      body: 'Registro imutável',
    })

    for (const actor of [general, coordinator, leader]) {
      await expect(
        payload.update({
          collection: 'nucleusUpdate',
          id: created.id,
          data: { body: 'Tentativa de edição' },
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      await expect(
        payload.delete({
          collection: 'nucleusUpdate',
          id: created.id,
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    }
  })

  it('recomputes the latest timestamp after deterministic concurrent creates', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createNucleusUpdateRecord(payload, general, {
          nucleus: nucleus.id,
          kind: 'nota',
          body: `Registro concorrente ${index}`,
        }),
      ),
    )
    const latestCreatedAt = created
      .map(({ createdAt }) => createdAt)
      .sort((left, right) => right.localeCompare(left))[0]

    const persistedNucleus = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus.id,
      depth: 0,
    })
    expect(persistedNucleus.lastUpdateAt).toBe(latestCreatedAt)
  })

  it('waits on the exact nucleus-updates namespace before recomputing derived state', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const holderID = await payload.db.beginTransaction()
    if (holderID === null) throw new Error('Expected a PostgreSQL transaction.')
    await acquireTextAdvisoryLocks(payload, { transactionID: holderID }, [
      `nucleus-updates:${nucleus.id}`,
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
    const pending = createNucleusUpdateRecord(payload, general, {
      nucleus: nucleus.id,
      kind: 'nota',
      body: 'Registro bloqueado até a liberação',
    })

    try {
      const expectedPID = await waiterPID
      await expect(
        waitForAdvisoryLockWaiter(payload, {
          key: `nucleus-updates:${nucleus.id}`,
          mode: 'ExclusiveLock',
          waiterPID: expectedPID,
        }),
      ).resolves.toMatchObject({ granted: false, pid: expectedPID })
      await payload.db.rollbackTransaction(holderID)
      const created = await pending
      await expect(
        payload.findByID({ collection: 'electoralNucleus', id: nucleus.id, depth: 0 }),
      ).resolves.toMatchObject({ lastUpdateAt: created.createdAt })
    } catch (error) {
      await payload.db.rollbackTransaction(holderID).catch(() => undefined)
      throw error
    } finally {
      beginSpy.mockRestore()
    }
  })

  it('recomputes after deterministic concurrent deletes of the latest records', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const created = []
    for (let index = 0; index < 4; index += 1) {
      created.push(
        await createNucleusUpdateRecord(payload, general, {
          nucleus: nucleus.id,
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
        collection: 'nucleusUpdate',
        id: latest.id,
        depth: 0,
      }),
      payload.delete({
        collection: 'nucleusUpdate',
        id: secondLatest.id,
        depth: 0,
      }),
    ])

    const persistedNucleus = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus.id,
      depth: 0,
    })
    expect(persistedNucleus.lastUpdateAt).toBe(expectedLatest.createdAt)
  })

  it('recomputes both nuclei after an admin reassigns an update', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const oldNucleus = await campaignFixtures().createNucleus()
    const newNucleus = await campaignFixtures().createNucleus()
    const oldRemaining = await createNucleusUpdateRecord(payload, general, {
      nucleus: oldNucleus.id,
      kind: 'nota',
      body: 'Permanece no núcleo original',
    })
    const moved = await createNucleusUpdateRecord(payload, general, {
      nucleus: oldNucleus.id,
      kind: 'nota',
      body: 'Será transferido',
    })

    await payload.update({
      collection: 'nucleusUpdate',
      id: moved.id,
      data: { nucleus: newNucleus.id },
      depth: 0,
    })

    const [persistedOld, persistedNew] = await Promise.all([
      payload.findByID({
        collection: 'electoralNucleus',
        id: oldNucleus.id,
        depth: 0,
      }),
      payload.findByID({
        collection: 'electoralNucleus',
        id: newNucleus.id,
        depth: 0,
      }),
    ])
    expect(persistedOld.lastUpdateAt).toBe(oldRemaining.createdAt)
    expect(persistedNew.lastUpdateAt).toBe(moved.createdAt)
  })

  it('updates lastUpdateAt on create and recomputes it after admin deletion', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const first = await createNucleusUpdateRecord(payload, general, {
      nucleus: nucleus.id,
      kind: 'nota',
      body: 'Primeiro registro',
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await createNucleusUpdateRecord(payload, general, {
      nucleus: nucleus.id,
      kind: 'nota',
      body: 'Segundo registro',
    })

    const afterCreate = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus.id,
      depth: 0,
    })
    expect(afterCreate.lastUpdateAt).toBe(second.createdAt)

    await payload.delete({
      collection: 'nucleusUpdate',
      id: second.id,
      depth: 0,
    })
    const afterLatestDelete = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus.id,
      depth: 0,
    })
    expect(afterLatestDelete.lastUpdateAt).toBe(first.createdAt)

    await payload.delete({
      collection: 'nucleusUpdate',
      id: first.id,
      depth: 0,
    })
    const afterAllDelete = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus.id,
      depth: 0,
    })
    expect(afterAllDelete.lastUpdateAt).toBeNull()
  })

  it('rolls back the update record when the derived nucleus write fails', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const originalUpdate = payload.update.bind(payload)
    const updateSpy = vi.spyOn(payload, 'update').mockImplementation(async (args) => {
      if (
        args.collection === 'electoralNucleus' &&
        args.data &&
        'lastUpdateAt' in args.data &&
        args.data.lastUpdateAt
      ) {
        throw new Error('falha forçada no campo derivado')
      }
      return originalUpdate(args as never) as never
    })

    try {
      await expect(
        createNucleusUpdateRecord(payload, general, {
          nucleus: nucleus.id,
          kind: 'nota',
          body: 'Este registro deve reverter',
        }),
      ).rejects.toThrow('falha forçada')
    } finally {
      updateSpy.mockRestore()
    }

    const persisted = await payload.find({
      collection: 'nucleusUpdate',
      where: { nucleus: { equals: nucleus.id } },
      depth: 0,
      pagination: false,
    })
    expect(persisted.totalDocs).toBe(0)
  })
})
