// @vitest-environment node

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import { createPlazaUpdateRecord } from '@/app/(campaign)/campanha/actions/plazaUpdate'
import { PlazaUpdate } from '@/collections/PlazaUpdate'
import { plazaUpdateCreateSchema } from '@/lib/schemas/plazaUpdate'
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
  coordinator: CampaignUser,
  leader: CampaignUser,
  plaza: number,
  supportStatus: 'engajado' | 'a_abordar',
) => {
  const contact = await campaignFixtures().createContact({
    name: campaignFixtures().value('Liderança atualização'),
  })
  return campaignFixtures().createLeadership({
    contact,
    plazas: [plaza],
    user: leader,
    supportStatus,
    createdBy: coordinator,
  })
}

const listPlazaUpdates = (user: CampaignUser, plazaID: number) =>
  payload.find({
    collection: 'plazaUpdate',
    where: { plaza: { equals: plazaID } },
    depth: 0,
    pagination: false,
    sort: '-createdAt',
    user,
    overrideAccess: false,
  })

describe('campaign plaza update domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('requires weekly answers and requires body for urgent notes', () => {
    expect(
      plazaUpdateCreateSchema.safeParse({
        plaza: 1,
        kind: 'semanal',
        worked: 'Mobilização na feira',
        failed: 'Chuva forte',
        needs: 'Material impresso',
      }).success,
    ).toBe(true)
    expect(
      plazaUpdateCreateSchema.safeParse({
        plaza: 1,
        kind: 'semanal',
        worked: 'Mobilização na feira',
      }).success,
    ).toBe(false)
    expect(
      plazaUpdateCreateSchema.safeParse({
        plaza: 1,
        kind: 'urgente',
        body: 'Precisamos responder hoje.',
      }).success,
    ).toBe(true)
    expect(
      plazaUpdateCreateSchema.safeParse({
        plaza: 1,
        kind: 'nota',
        body: '   ',
      }).success,
    ).toBe(false)
  })

  it('strips forged author and timestamps from input', () => {
    const parsed = plazaUpdateCreateSchema.parse({
      plaza: 1,
      kind: 'nota',
      body: 'Registro de campo',
      author: 999,
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
    } as never)

    expect(parsed).toEqual({
      plaza: 1,
      kind: 'nota',
      body: 'Registro de campo',
    })
  })

  it('enforces kind validation through the Local API', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const plaza = await campaignFixtures().getPlaza()

    await expect(
      payload.create({
        collection: 'plazaUpdate',
        data: {
          plaza: plaza.id,
          kind: 'semanal',
          worked: 'Somente uma resposta',
        } as never,
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow('não funcionou')
    await expect(
      payload.create({
        collection: 'plazaUpdate',
        data: {
          plaza: plaza.id,
          kind: 'urgente',
          body: '   ',
        } as never,
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow('texto')
  })

  it('declares immutable app records and server-managed authorship', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const updateAccess =
      typeof PlazaUpdate.access?.update === 'function'
        ? await PlazaUpdate.access.update({
            id: 1,
            data: undefined,
            req: { user: coordinator } as never,
          })
        : PlazaUpdate.access?.update
    const deleteAccess =
      typeof PlazaUpdate.access?.delete === 'function'
        ? await PlazaUpdate.access.delete({
            id: 1,
            data: undefined,
            req: { user: coordinator } as never,
          })
        : PlazaUpdate.access?.delete

    expect(updateAccess).toBe(false)
    expect(deleteAccess).toBe(false)
    expect(PlazaUpdate.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'author', relationTo: 'campaignUser', required: true }),
      ]),
    )
  })

  it('lets the coordinator create and read every update', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const plaza = await campaignFixtures().getPlaza()
    const created = await createPlazaUpdateRecord(payload, coordinator, {
      plaza: plaza.id,
      kind: 'semanal',
      worked: 'Visitas concluídas',
      failed: 'Dois endereços fechados',
      needs: 'Mais panfletos',
      activeVolunteers: 7,
      newSupports: 12,
      author: 999,
    } as never)

    expect(created.author).toBe(coordinator.id)
    const visible = await listPlazaUpdates(coordinator, plaza.id)
    expect(visible.docs.map(({ id }) => id)).toContain(created.id)
  })

  it('limits advisors to administered plazas for create and read', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const otherAdvisor = await campaignFixtures().createCampaignUser('advisor')
    const assigned = await campaignFixtures().getPlaza()
    const other = await campaignFixtures().getPlaza()
    await campaignFixtures().assignPlazaAdvisors(assigned, [advisor])
    await campaignFixtures().assignPlazaAdvisors(other, [otherAdvisor])

    const created = await createPlazaUpdateRecord(payload, advisor, {
      plaza: assigned.id,
      kind: 'nota',
      body: 'Atualização permitida',
    })
    expect((await listPlazaUpdates(advisor, assigned.id)).docs).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })]),
    )
    await expect(
      createPlazaUpdateRecord(payload, advisor, {
        plaza: other.id,
        kind: 'nota',
        body: 'Atualização fora do escopo',
      }),
    ).rejects.toThrow()

    await createPlazaUpdateRecord(payload, otherAdvisor, {
      plaza: other.id,
      kind: 'nota',
      body: 'Atualização alheia',
    })
    const foreign = await listPlazaUpdates(advisor, other.id)
    expect(foreign.docs).toHaveLength(0)
  })

  it('lets an engaged leader create and read only their authored updates', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const leader = await campaignFixtures().createCampaignUser('leader')
    const otherLeader = await campaignFixtures().createCampaignUser('leader')
    const plaza = await campaignFixtures().getPlaza()
    await createUpdateAccessLeadershipGraph(coordinator, leader, plaza.id, 'engajado')
    await createUpdateAccessLeadershipGraph(coordinator, otherLeader, plaza.id, 'engajado')

    const own = await createPlazaUpdateRecord(payload, leader, {
      plaza: plaza.id,
      kind: 'urgente',
      body: 'Pedido da própria liderança',
    })
    await createPlazaUpdateRecord(payload, otherLeader, {
      plaza: plaza.id,
      kind: 'nota',
      body: 'Registro de outra liderança',
    })

    const visible = await listPlazaUpdates(leader, plaza.id)
    expect(visible.docs.map(({ id }) => id)).toEqual([own.id])
  })

  it('denies unlinked and non-engaged leader creation', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const unlinked = await campaignFixtures().createCampaignUser('leader')
    const inactive = await campaignFixtures().createCampaignUser('leader')
    const plaza = await campaignFixtures().getPlaza()
    await createUpdateAccessLeadershipGraph(coordinator, inactive, plaza.id, 'a_abordar')

    for (const actor of [unlinked, inactive]) {
      await expect(
        createPlazaUpdateRecord(payload, actor, {
          plaza: plaza.id,
          kind: 'nota',
          body: 'Sem vínculo engajado',
        }),
      ).rejects.toThrow()
    }
  })

  it('denies anonymous create and read operations', async () => {
    const plaza = await campaignFixtures().getPlaza()

    await expect(
      payload.create({
        collection: 'plazaUpdate',
        data: {
          plaza: plaza.id,
          kind: 'nota',
          body: 'Tentativa anônima',
        } as never,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.find({
        collection: 'plazaUpdate',
        depth: 0,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('denies actual Local API update and delete operations for every campaign role', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const leader = await campaignFixtures().createCampaignUser('leader')
    const plaza = await campaignFixtures().getPlaza()
    await campaignFixtures().assignPlazaAdvisors(plaza, [advisor])
    await createUpdateAccessLeadershipGraph(coordinator, leader, plaza.id, 'engajado')
    const created = await createPlazaUpdateRecord(payload, coordinator, {
      plaza: plaza.id,
      kind: 'nota',
      body: 'Registro imutável',
    })

    for (const actor of [coordinator, advisor, leader]) {
      await expect(
        payload.update({
          collection: 'plazaUpdate',
          id: created.id,
          data: { body: 'Tentativa de edição' },
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      await expect(
        payload.delete({
          collection: 'plazaUpdate',
          id: created.id,
          user: actor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    }
  })

  it('recomputes the latest timestamp after deterministic concurrent creates', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const plaza = await campaignFixtures().getPlaza()
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createPlazaUpdateRecord(payload, coordinator, {
          plaza: plaza.id,
          kind: 'nota',
          body: `Registro concorrente ${index}`,
        }),
      ),
    )
    const latestCreatedAt = created
      .map(({ createdAt }) => createdAt)
      .sort((left, right) => right.localeCompare(left))[0]

    const persistedPlaza = await payload.findByID({
      collection: 'plaza',
      id: plaza.id,
      depth: 0,
    })
    expect(persistedPlaza.lastUpdateAt).toBe(latestCreatedAt)
  })

  it('waits on the exact plaza-updates namespace before recomputing derived state', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const plaza = await campaignFixtures().getPlaza()
    const holderID = await payload.db.beginTransaction()
    if (holderID === null) throw new Error('Expected a PostgreSQL transaction.')
    await acquireTextAdvisoryLocks(payload, { transactionID: holderID }, [
      `plaza-updates:${plaza.id}`,
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
    const pending = createPlazaUpdateRecord(payload, coordinator, {
      plaza: plaza.id,
      kind: 'nota',
      body: 'Registro bloqueado até a liberação',
    })

    try {
      const expectedPID = await waiterPID
      await expect(
        waitForAdvisoryLockWaiter(payload, {
          key: `plaza-updates:${plaza.id}`,
          mode: 'ExclusiveLock',
          waiterPID: expectedPID,
        }),
      ).resolves.toMatchObject({ granted: false, pid: expectedPID })
      await payload.db.rollbackTransaction(holderID)
      const created = await pending
      await expect(
        payload.findByID({ collection: 'plaza', id: plaza.id, depth: 0 }),
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
    const plaza = await campaignFixtures().getPlaza()
    const created = []
    for (let index = 0; index < 4; index += 1) {
      created.push(
        await createPlazaUpdateRecord(payload, coordinator, {
          plaza: plaza.id,
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
        collection: 'plazaUpdate',
        id: latest.id,
        depth: 0,
      }),
      payload.delete({
        collection: 'plazaUpdate',
        id: secondLatest.id,
        depth: 0,
      }),
    ])

    const persistedPlaza = await payload.findByID({
      collection: 'plaza',
      id: plaza.id,
      depth: 0,
    })
    expect(persistedPlaza.lastUpdateAt).toBe(expectedLatest.createdAt)
  })

  it('recomputes both plazas after an admin reassigns an update', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const oldPlaza = await campaignFixtures().getPlaza()
    const newPlaza = await campaignFixtures().getPlaza()
    const oldRemaining = await createPlazaUpdateRecord(payload, coordinator, {
      plaza: oldPlaza.id,
      kind: 'nota',
      body: 'Permanece na Praça original',
    })
    const moved = await createPlazaUpdateRecord(payload, coordinator, {
      plaza: oldPlaza.id,
      kind: 'nota',
      body: 'Será transferido',
    })

    await payload.update({
      collection: 'plazaUpdate',
      id: moved.id,
      data: { plaza: newPlaza.id },
      depth: 0,
    })

    const [persistedOld, persistedNew] = await Promise.all([
      payload.findByID({
        collection: 'plaza',
        id: oldPlaza.id,
        depth: 0,
      }),
      payload.findByID({
        collection: 'plaza',
        id: newPlaza.id,
        depth: 0,
      }),
    ])
    expect(persistedOld.lastUpdateAt).toBe(oldRemaining.createdAt)
    expect(persistedNew.lastUpdateAt).toBe(moved.createdAt)
  })

  it('updates lastUpdateAt on create and recomputes it after admin deletion', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const plaza = await campaignFixtures().getPlaza()
    const first = await createPlazaUpdateRecord(payload, coordinator, {
      plaza: plaza.id,
      kind: 'nota',
      body: 'Primeiro registro',
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await createPlazaUpdateRecord(payload, coordinator, {
      plaza: plaza.id,
      kind: 'nota',
      body: 'Segundo registro',
    })

    const afterCreate = await payload.findByID({
      collection: 'plaza',
      id: plaza.id,
      depth: 0,
    })
    expect(afterCreate.lastUpdateAt).toBe(second.createdAt)

    await payload.delete({
      collection: 'plazaUpdate',
      id: second.id,
      depth: 0,
    })
    const afterLatestDelete = await payload.findByID({
      collection: 'plaza',
      id: plaza.id,
      depth: 0,
    })
    expect(afterLatestDelete.lastUpdateAt).toBe(first.createdAt)

    await payload.delete({
      collection: 'plazaUpdate',
      id: first.id,
      depth: 0,
    })
    const afterAllDelete = await payload.findByID({
      collection: 'plaza',
      id: plaza.id,
      depth: 0,
    })
    expect(afterAllDelete.lastUpdateAt).toBeNull()
  })

  it('rolls back the update record when the derived plaza write fails', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const plaza = await campaignFixtures().getPlaza()
    const originalUpdate = payload.update.bind(payload)
    const updateSpy = vi.spyOn(payload, 'update').mockImplementation(async (args) => {
      if (
        args.collection === 'plaza' &&
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
        createPlazaUpdateRecord(payload, coordinator, {
          plaza: plaza.id,
          kind: 'nota',
          body: 'Este registro deve reverter',
        }),
      ).rejects.toThrow('falha forçada')
    } finally {
      updateSpy.mockRestore()
    }

    const persisted = await payload.find({
      collection: 'plazaUpdate',
      where: { plaza: { equals: plaza.id } },
      depth: 0,
      pagination: false,
    })
    expect(persisted.totalDocs).toBe(0)
  })
})
