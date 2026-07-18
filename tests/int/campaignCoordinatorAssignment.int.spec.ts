// @vitest-environment node

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import { assignNucleusCoordinatorsRecord } from '@/app/(campaign)/campanha/actions/coordinatorAssignment'
import { updateElectoralNucleus } from '@/app/(campaign)/campanha/actions/nucleus'
import config from '@/payload.config'
import { getNucleusCoordinatorAssignmentPageData } from '@/utilities/nucleusCoordinatorAssignmentPageData'
import { resolveAccessibleNucleusContext } from '@/utilities/nucleusPageData'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import {
  getTestTransactionBackendPID,
  waitForAdvisoryLockWaiter,
} from '../helpers/testDatabaseLease'

import { withCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload

describe('campaign coordinator assignment', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('lets only fresh general coordination replace assignments with eligible users', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const coordinator = await fixtures.createCampaignUser('coordenador')
      const replacement = await fixtures.createCampaignUser('coordenador')
      const leadership = await fixtures.createCampaignUser('lideranca')
      const nucleus = await fixtures.createNucleus({ coordinators: [coordinator.id] })

      const updated = await assignNucleusCoordinatorsRecord(payload, general, {
        slug: nucleus.slug,
        coordinatorIds: [general.id, replacement.id],
        expectedUpdatedAt: nucleus.updatedAt,
      })

      expect(updated.coordinators).toEqual([general.id, replacement.id])
      await expect(
        assignNucleusCoordinatorsRecord(payload, coordinator, {
          slug: nucleus.slug,
          coordinatorIds: [coordinator.id],
          expectedUpdatedAt: updated.updatedAt,
        }),
      ).rejects.toThrow('coordenação geral')
      await expect(
        assignNucleusCoordinatorsRecord(payload, leadership, {
          slug: nucleus.slug,
          coordinatorIds: [],
          expectedUpdatedAt: updated.updatedAt,
        }),
      ).rejects.toThrow('coordenação geral')
      await expect(
        assignNucleusCoordinatorsRecord(payload, general, {
          slug: nucleus.slug,
          coordinatorIds: [leadership.id],
          expectedUpdatedAt: updated.updatedAt,
        }),
      ).rejects.toThrow('elegíveis')
    })
  })

  it('rejects stale dialogs under the nucleus lock without overwriting newer assignments', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const first = await fixtures.createCampaignUser('coordenador')
      const second = await fixtures.createCampaignUser('coordenador')
      const nucleus = await fixtures.createNucleus()

      const firstUpdate = await assignNucleusCoordinatorsRecord(payload, general, {
        slug: nucleus.slug,
        coordinatorIds: [first.id],
        expectedUpdatedAt: nucleus.updatedAt,
      })

      await expect(
        assignNucleusCoordinatorsRecord(payload, general, {
          slug: nucleus.slug,
          coordinatorIds: [second.id],
          expectedUpdatedAt: nucleus.updatedAt,
        }),
      ).rejects.toThrow('alterada')

      const persisted = await payload.findByID({
        collection: 'electoralNucleus',
        id: nucleus.id,
        depth: 0,
      })
      expect(persisted.coordinators).toEqual([first.id])
      expect(persisted.updatedAt).toBe(firstUpdate.updatedAt)
    })
  })

  it('waits on the exact coordinator-assignment namespace before revision checks', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const coordinator = await fixtures.createCampaignUser('coordenador')
      const nucleus = await fixtures.createNucleus()
      const holderID = await payload.db.beginTransaction()
      if (holderID === null) throw new Error('Expected a PostgreSQL transaction.')
      await acquireTextAdvisoryLocks(payload, { transactionID: holderID }, [
        `coordinator-assignment:${nucleus.id}`,
      ])

      const originalBegin = payload.db.beginTransaction.bind(payload.db)
      let resolveWaiterPID!: (pid: number) => void
      const waiterPID = new Promise<number>((resolve) => {
        resolveWaiterPID = resolve
      })
      const beginSpy = vi.spyOn(payload.db, 'beginTransaction').mockImplementation(async () => {
        const transactionID = await originalBegin()
        if (transactionID === null) throw new Error('Expected assignment transaction.')
        resolveWaiterPID(await getTestTransactionBackendPID(payload, transactionID))
        return transactionID
      })
      const pending = assignNucleusCoordinatorsRecord(payload, general, {
        slug: nucleus.slug,
        coordinatorIds: [coordinator.id],
        expectedUpdatedAt: nucleus.updatedAt,
      })

      try {
        const expectedPID = await waiterPID
        await expect(
          waitForAdvisoryLockWaiter(payload, {
            key: `coordinator-assignment:${nucleus.id}`,
            mode: 'ExclusiveLock',
            waiterPID: expectedPID,
          }),
        ).resolves.toMatchObject({ granted: false, pid: expectedPID })
        await payload.db.rollbackTransaction(holderID)
        await expect(pending).resolves.toMatchObject({ coordinators: [coordinator.id] })
      } catch (error) {
        await payload.db.rollbackTransaction(holderID).catch(() => undefined)
        throw error
      } finally {
        beginSpy.mockRestore()
      }
    })
  })

  it('does not lose a dedicated assignment when a generic crafted update runs concurrently', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const coordinator = await fixtures.createCampaignUser('coordenador')
      const replacement = await fixtures.createCampaignUser('coordenador')
      const nucleus = await fixtures.createNucleus({ coordinators: [coordinator.id] })

      const [assignmentResult, genericResult] = await Promise.allSettled([
        assignNucleusCoordinatorsRecord(payload, general, {
          slug: nucleus.slug,
          coordinatorIds: [replacement.id],
          expectedUpdatedAt: nucleus.updatedAt,
        }),
        updateElectoralNucleus(payload, general, {
          id: nucleus.id,
          coordinators: [coordinator.id],
          territoryNotes: 'Atualização concorrente',
        } as never),
      ])
      expect(genericResult.status).toBe('fulfilled')

      let persisted = await payload.findByID({
        collection: 'electoralNucleus',
        id: nucleus.id,
        depth: 0,
      })
      if (assignmentResult.status === 'rejected') {
        expect(assignmentResult.reason).toEqual(
          expect.objectContaining({ message: expect.any(String) }),
        )
        persisted = await assignNucleusCoordinatorsRecord(payload, general, {
          slug: nucleus.slug,
          coordinatorIds: [replacement.id],
          expectedUpdatedAt: persisted.updatedAt,
        })
      }

      expect(persisted.coordinators).toEqual([replacement.id])
      expect(persisted.territoryNotes).toBe('Atualização concorrente')
    })
  })

  it('returns a minimal scoped DTO with dedicated phones but no auth identity fields', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const phone = fixtures.phone()
      const coordinator = await fixtures.createCampaignUser('coordenador', { phone })
      const leader = await fixtures.createCampaignUser('lideranca')
      const nucleus = await fixtures.createNucleus({
        coordinators: [general.id, coordinator.id],
      })
      const contact = await fixtures.createContact({
        name: fixtures.value('Liderança'),
        phone: fixtures.phone(),
      })
      await fixtures.createLeadership({
        contact,
        nucleus,
        user: leader,
        supportStatus: 'engajado',
        createdBy: general,
      })

      const context = await resolveAccessibleNucleusContext(payload, leader, nucleus.slug)
      const view = await getNucleusCoordinatorAssignmentPageData(payload, leader, context)

      expect(view.coordinators).toEqual([
        { id: general.id, name: general.name, phone: null },
        { id: coordinator.id, name: coordinator.name, phone },
      ])
      expect(JSON.stringify(view)).not.toContain('email')
      expect(JSON.stringify(view)).not.toContain('username')
      expect(view).not.toHaveProperty('eligibleOptions')
    })
  })
})
