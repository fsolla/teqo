// @vitest-environment node

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import {
  confirmVoteEstimateRecord,
  suggestVoteEstimateRecord,
} from '@/app/(campaign)/campanha/actions/voteEstimate'
import { suggestVoteEstimateFormAction } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/voteEstimateFormActions'
import { confirmVoteEstimateSchema, suggestVoteEstimateSchema } from '@/lib/schemas/voteEstimate'
import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'
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

// Builds the Contact → Leadership graph that grants or denies estimate access.
const createEstimateAccessLeadershipGraph = async (
  general: CampaignUser,
  leader: CampaignUser,
  nucleus: number,
  supportStatus: 'engajado' | 'a_abordar',
) => {
  const contact = await campaignFixtures().createContact({
    name: campaignFixtures().value('Liderança estimativa'),
    phone: campaignFixtures().phone(),
  })
  return campaignFixtures().createLeadership({
    contact,
    nucleus,
    user: leader,
    supportStatus,
    createdBy: general,
  })
}

describe('campaign vote estimate actions', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('rejects a blank estimate instead of coercing it to zero', async () => {
    const formData = new FormData()
    formData.set('nucleus', '1')
    formData.set('estimate', '')

    await expect(suggestVoteEstimateFormAction({}, formData)).resolves.toMatchObject({
      fieldErrors: { estimate: [expect.any(String)] },
    })
  })

  it('accepts only estimate inputs and strips forged audit fields', () => {
    const forged = {
      nucleus: 12,
      estimate: 1500,
      proposedVoteEstimateAt: '2000-01-01T00:00:00.000Z',
      proposedVoteEstimateBy: 999,
      proposedVoteEstimateVersion: '37d7916c-d4a9-4ca3-bd71-cb1c767f6eb5',
      confirmedVoteEstimateAt: '2000-01-01T00:00:00.000Z',
      confirmedVoteEstimateBy: 999,
    }

    expect(suggestVoteEstimateSchema.parse(forged)).toEqual({
      nucleus: 12,
      estimate: 1500,
    })
    expect(
      confirmVoteEstimateSchema.parse({
        ...forged,
        expectedProposedVoteEstimateVersion: '37d7916c-d4a9-4ca3-bd71-cb1c767f6eb5',
        confirmationNote: '  Ajuste local  ',
      }),
    ).toEqual({
      nucleus: 12,
      estimate: 1500,
      expectedProposedVoteEstimateVersion: '37d7916c-d4a9-4ca3-bd71-cb1c767f6eb5',
      confirmationNote: 'Ajuste local',
    })
    expect(() => suggestVoteEstimateSchema.parse({ nucleus: 12, estimate: -1 })).toThrow()
  })

  it('lets an engaged leadership suggest while preserving the confirmed estimate', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leader = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    await createEstimateAccessLeadershipGraph(general, leader, nucleus.id, 'engajado')
    await payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: {
        confirmedVoteEstimate: 900,
        confirmedVoteEstimateAt: '2026-07-01T00:00:00.000Z',
        confirmedVoteEstimateBy: general.id,
      },
      depth: 0,
    })

    const before = Date.now()
    const updated = await suggestVoteEstimateRecord(payload, leader, {
      nucleus: nucleus.id,
      estimate: 1200,
      proposedVoteEstimateAt: '2000-01-01T00:00:00.000Z',
      proposedVoteEstimateBy: general.id,
    } as never)

    expect(updated.confirmedVoteEstimate).toBe(900)
    expect(updated.proposedVoteEstimate).toBe(1200)
    expect(updated.proposedVoteEstimateBy).toBe(leader.id)
    expect(new Date(updated.proposedVoteEstimateAt!).getTime()).toBeGreaterThanOrEqual(before)
  })

  it('rejects leadership suggestions without an engaged target link', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const unlinkedLeader = await campaignFixtures().createCampaignUser('lideranca')
    const inactiveLeader = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    await createEstimateAccessLeadershipGraph(general, inactiveLeader, nucleus.id, 'a_abordar')

    await expect(
      suggestVoteEstimateRecord(payload, unlinkedLeader, {
        nucleus: nucleus.id,
        estimate: 700,
      }),
    ).rejects.toThrow('vínculo engajado')
    await expect(
      suggestVoteEstimateRecord(payload, inactiveLeader, {
        nucleus: nucleus.id,
        estimate: 700,
      }),
    ).rejects.toThrow('vínculo engajado')
  })

  it('limits coordinator confirmation to assigned nuclei', async () => {
    const assignedCoordinator = await campaignFixtures().createCampaignUser('coordenador')
    const otherCoordinator = await campaignFixtures().createCampaignUser('coordenador')
    const assigned = await campaignFixtures().createNucleus({
      coordinators: [assignedCoordinator.id],
    })
    const other = await campaignFixtures().createNucleus({ coordinators: [otherCoordinator.id] })

    const assignedProposal = await suggestVoteEstimateRecord(payload, assignedCoordinator, {
      nucleus: assigned.id,
      estimate: 1800,
    })
    const otherProposal = await suggestVoteEstimateRecord(payload, otherCoordinator, {
      nucleus: other.id,
      estimate: 2200,
    })

    await expect(
      confirmVoteEstimateRecord(payload, assignedCoordinator, {
        nucleus: other.id,
        estimate: 2200,
        expectedProposedVoteEstimateVersion: otherProposal.proposedVoteEstimateVersion!,
      }),
    ).rejects.toThrow()

    const confirmed = await confirmVoteEstimateRecord(payload, assignedCoordinator, {
      nucleus: assigned.id,
      estimate: 1800,
      expectedProposedVoteEstimateVersion: assignedProposal.proposedVoteEstimateVersion!,
      confirmedVoteEstimateAt: '2000-01-01T00:00:00.000Z',
      confirmedVoteEstimateBy: otherCoordinator.id,
    } as never)

    expect(confirmed.confirmedVoteEstimate).toBe(1800)
    expect(confirmed.confirmedVoteEstimateBy).toBe(assignedCoordinator.id)
    expect(confirmed.confirmedVoteEstimateAt).not.toBe('2000-01-01T00:00:00.000Z')
    expect(confirmed.proposedVoteEstimate).toBeNull()
    expect(confirmed.proposedVoteEstimateAt).toBeNull()
    expect(confirmed.proposedVoteEstimateBy).toBeNull()
    expect(confirmed.proposedVoteEstimateVersion).toBeNull()
  })

  it('requires a confirmation note only when adjusting the proposal', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const proposal = await suggestVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 3000,
    })

    await expect(
      confirmVoteEstimateRecord(payload, general, {
        nucleus: nucleus.id,
        estimate: 2800,
        expectedProposedVoteEstimateVersion: proposal.proposedVoteEstimateVersion!,
      }),
    ).rejects.toThrow('justificativa')

    const confirmed = await confirmVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 2800,
      expectedProposedVoteEstimateVersion: proposal.proposedVoteEstimateVersion!,
      confirmationNote: 'Ajuste após conferência em campo',
    })

    expect(confirmed.confirmedVoteEstimate).toBe(2800)
    expect(confirmed.confirmationNote).toBe('Ajuste após conferência em campo')
    expect(confirmed.proposedVoteEstimate).toBeNull()
  })

  it('lets assigned staff replace a confirmed estimate directly with a justification', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus({ coordinators: [coordinator.id] })
    const previousConfirmationAt = '2026-07-01T00:00:00.000Z'
    await payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: {
        confirmedVoteEstimate: 900,
        confirmedVoteEstimateAt: previousConfirmationAt,
        confirmedVoteEstimateBy: general.id,
      },
      depth: 0,
    })

    await expect(
      confirmVoteEstimateRecord(payload, coordinator, {
        nucleus: nucleus.id,
        estimate: 1100,
        expectedProposedVoteEstimateVersion: null,
      } as never),
    ).rejects.toThrow('justificativa')

    const unchanged = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus.id,
      depth: 0,
    })
    expect(unchanged.confirmedVoteEstimate).toBe(900)
    expect(unchanged.confirmedVoteEstimateAt).toBe(previousConfirmationAt)
    expect(unchanged.confirmedVoteEstimateBy).toBe(general.id)

    const replaced = await confirmVoteEstimateRecord(payload, coordinator, {
      nucleus: nucleus.id,
      estimate: 1100,
      expectedProposedVoteEstimateVersion: null,
      confirmationNote: 'Meta revisada após nova rodada territorial',
    } as never)

    expect(replaced.confirmedVoteEstimate).toBe(1100)
    expect(replaced.confirmedVoteEstimateBy).toBe(coordinator.id)
    expect(replaced.confirmedVoteEstimateAt).not.toBe(previousConfirmationAt)
    expect(replaced.confirmationNote).toBe('Meta revisada após nova rodada territorial')
    expect(replaced.proposedVoteEstimate).toBeNull()
  })

  it('rejects a stale confirmation instead of clearing a newer suggestion', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const staleProposal = await suggestVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 3000,
    })
    await suggestVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 3500,
    })

    await expect(
      confirmVoteEstimateRecord(payload, general, {
        nucleus: nucleus.id,
        estimate: 3000,
        expectedProposedVoteEstimateVersion: staleProposal.proposedVoteEstimateVersion!,
        confirmationNote: 'Confirmação aberta antes da nova sugestão',
      } as never),
    ).rejects.toThrow('alterada')

    const persisted = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus.id,
      depth: 0,
    })
    expect(persisted.confirmedVoteEstimate).toBeNull()
    expect(persisted.proposedVoteEstimate).toBe(3500)
    expect(persisted.proposedVoteEstimateBy).toBe(general.id)
    expect(persisted.proposedVoteEstimateVersion).not.toBe(
      staleProposal.proposedVoteEstimateVersion,
    )
  })

  it('assigns different versions to consecutive same-value proposals', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()

    const first = await suggestVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 3000,
    })
    const second = await suggestVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 3000,
    })

    expect(first.proposedVoteEstimateVersion).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(second.proposedVoteEstimateVersion).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(second.proposedVoteEstimateVersion).not.toBe(first.proposedVoteEstimateVersion)
  })

  it('does not allow a campaign client to forge the stored proposal version', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const proposal = await suggestVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 3000,
    })

    await payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: {
        proposedVoteEstimateVersion: '37d7916c-d4a9-4ca3-bd71-cb1c767f6eb5',
      },
      depth: 0,
      user: general,
      overrideAccess: false,
    })

    const persisted = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus.id,
      depth: 0,
    })
    expect(persisted.proposedVoteEstimateVersion).toBe(proposal.proposedVoteEstimateVersion)
  })

  it('rejects an A to B to A stale confirmation and preserves the newest proposal', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const firstA = await suggestVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 3000,
    })
    await suggestVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 3500,
    })
    const newestA = await suggestVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 3000,
    })

    await expect(
      confirmVoteEstimateRecord(payload, general, {
        nucleus: nucleus.id,
        estimate: 3000,
        expectedProposedVoteEstimateVersion: firstA.proposedVoteEstimateVersion!,
      } as never),
    ).rejects.toThrow('alterada')

    const persisted = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus.id,
      depth: 0,
    })
    expect(persisted.confirmedVoteEstimate).toBeNull()
    expect(persisted.proposedVoteEstimate).toBe(3000)
    expect(persisted.proposedVoteEstimateVersion).toBe(newestA.proposedVoteEstimateVersion)
  })

  it('serializes a racing confirmation before a newer suggestion without clearing it', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    const proposal = await suggestVoteEstimateRecord(payload, general, {
      nucleus: nucleus.id,
      estimate: 3000,
    })

    const originalUpdate = payload.update.bind(payload)
    let releaseConfirmation = () => {}
    const confirmationGate = new Promise<void>((resolve) => {
      releaseConfirmation = resolve
    })
    let confirmationReachedUpdate = () => {}
    const confirmationAtUpdate = new Promise<void>((resolve) => {
      confirmationReachedUpdate = resolve
    })
    const updateSpy = vi.spyOn(payload, 'update').mockImplementation(async (args) => {
      if (
        args.collection === 'electoralNucleus' &&
        'data' in args &&
        args.data &&
        'confirmedVoteEstimate' in args.data
      ) {
        confirmationReachedUpdate()
        await confirmationGate
      }
      return (await originalUpdate(args as never)) as never
    })
    const originalBeginTransaction = payload.db.beginTransaction.bind(payload.db)
    const transactionPIDs: Array<(pid: number) => void> = []
    const nextTransactionPID = () =>
      new Promise<number>((resolve) => {
        transactionPIDs.push(resolve)
      })
    const confirmationPID = nextTransactionPID()
    const suggestionPID = nextTransactionPID()
    const beginSpy = vi.spyOn(payload.db, 'beginTransaction').mockImplementation(async () => {
      const transactionID = await originalBeginTransaction()
      if (transactionID === null) {
        throw new Error('Expected the vote estimate transaction to start.')
      }
      transactionPIDs.shift()?.(await getTestTransactionBackendPID(payload, transactionID))
      return transactionID
    })

    try {
      const confirmation = confirmVoteEstimateRecord(payload, general, {
        nucleus: nucleus.id,
        estimate: 3000,
        expectedProposedVoteEstimateVersion: proposal.proposedVoteEstimateVersion!,
      })
      const holderPID = await confirmationPID
      await confirmationAtUpdate

      const suggestion = suggestVoteEstimateRecord(payload, general, {
        nucleus: nucleus.id,
        estimate: 3500,
      })
      const expectedWaiterPID = await suggestionPID
      const waiting = await waitForAdvisoryLockWaiter(payload, {
        key: `vote-estimate:${nucleus.id}`,
        mode: 'ExclusiveLock',
        waiterPID: expectedWaiterPID,
      })

      expect(waiting).toMatchObject({
        activityDatabaseOID: waiting.databaseOID,
        classID: waiting.expectedClassID,
        granted: false,
        mode: 'ExclusiveLock',
        objectID: waiting.expectedObjectID,
        objectSubID: 1,
        pid: expectedWaiterPID,
      })
      expect(waiting.databaseOID).toBeGreaterThan(0)
      expect(expectedWaiterPID).not.toBe(holderPID)
      releaseConfirmation()
      await Promise.all([confirmation, suggestion])
    } finally {
      releaseConfirmation()
      beginSpy.mockRestore()
      updateSpy.mockRestore()
    }

    const persisted = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus.id,
      depth: 0,
    })
    expect(persisted.confirmedVoteEstimate).toBe(3000)
    expect(persisted.proposedVoteEstimate).toBe(3500)
    expect(persisted.proposedVoteEstimateBy).toBe(general.id)
  })

  it('does not let a leadership confirm a pending proposal', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leader = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    await createEstimateAccessLeadershipGraph(general, leader, nucleus.id, 'engajado')
    const proposal = await suggestVoteEstimateRecord(payload, leader, {
      nucleus: nucleus.id,
      estimate: 1100,
    })

    await expect(
      confirmVoteEstimateRecord(payload, leader, {
        nucleus: nucleus.id,
        estimate: 1100,
        expectedProposedVoteEstimateVersion: proposal.proposedVoteEstimateVersion!,
      }),
    ).rejects.toThrow('coordenação')
  })
})
