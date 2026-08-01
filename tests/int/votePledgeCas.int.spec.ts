// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  declareVotesRecord,
  estimateVotesCasRecord,
  estimateVotesRecord,
} from '@/app/(campaign)/campanha/actions/votePledge'
import {
  isOpsEstimateConflictMessage,
  OPS_ESTIMATE_CONFLICT_MESSAGE,
  parseOpsEstimateConflictServerEstimatedAt,
} from '@/lib/schemas/votePledge'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('estimateVotesCas (OH6)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const createPledgeForAdvisor = async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'engajado',
    })
    const pledge = await declareVotesRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 100,
    })
    fixtures.own('votePledge', pledge.id)
    return { fixtures, advisor, pledge }
  }

  it('writes like estimateVotes when baseEstimatedAt is omitted', async () => {
    const { advisor, pledge } = await createPledgeForAdvisor()

    const updated = await estimateVotesCasRecord(payload, advisor, {
      pledge: pledge.id,
      estimatedVotes: { pessimistic: null, central: 40, optimistic: null },
      estimateNote: null,
    })

    expect(updated.estimatedVotes?.central).toBe(40)
    expect(updated.estimatedAt).toBeTruthy()
    expect(updated.estimatedBy).toBe(advisor.id)
  })

  it('refuses a stale baseEstimatedAt without writing', async () => {
    const { advisor, pledge } = await createPledgeForAdvisor()

    const first = await estimateVotesRecord(payload, advisor, {
      pledge: pledge.id,
      estimatedVotes: { pessimistic: null, central: 50, optimistic: null },
      estimateNote: 'primeira',
    })
    expect(first.estimatedAt).toBeTruthy()

    await estimateVotesRecord(payload, advisor, {
      pledge: pledge.id,
      estimatedVotes: { pessimistic: null, central: 75, optimistic: null },
      estimateNote: 'segunda',
    })

    await expect(
      estimateVotesCasRecord(payload, advisor, {
        pledge: pledge.id,
        estimatedVotes: { pessimistic: null, central: 99, optimistic: null },
        estimateNote: 'stale',
        baseEstimatedAt: first.estimatedAt ?? null,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(Error)
      const message = (error as Error).message
      expect(isOpsEstimateConflictMessage(message)).toBe(true)
      expect(message.startsWith(OPS_ESTIMATE_CONFLICT_MESSAGE)).toBe(true)
      return true
    })

    const current = await payload.findByID({
      collection: 'votePledge',
      id: pledge.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(current.estimatedVotes?.central).toBe(75)
    expect(current.estimateNote).toBe('segunda')
  })

  it('writes when baseEstimatedAt matches and refreshes estimatedAt/estimatedBy', async () => {
    const { advisor, pledge } = await createPledgeForAdvisor()

    const first = await estimateVotesRecord(payload, advisor, {
      pledge: pledge.id,
      estimatedVotes: { pessimistic: 10, central: 20, optimistic: 30 },
      estimateNote: null,
    })
    const baseEstimatedAt = first.estimatedAt ?? null
    expect(baseEstimatedAt).toBeTruthy()

    const updated = await estimateVotesCasRecord(payload, advisor, {
      pledge: pledge.id,
      estimatedVotes: { pessimistic: 11, central: 22, optimistic: 33 },
      estimateNote: 'cas ok',
      baseEstimatedAt,
    })

    expect(updated.estimatedVotes?.central).toBe(22)
    expect(updated.estimateNote).toBe('cas ok')
    expect(updated.estimatedBy).toBe(advisor.id)
    expect(updated.estimatedAt).toBeTruthy()
    expect(updated.estimatedAt).not.toBe(baseEstimatedAt)
  })

  it('accepts null baseEstimatedAt only while the row has never been estimated', async () => {
    const { advisor, pledge } = await createPledgeForAdvisor()
    expect(pledge.estimatedAt ?? null).toBeNull()

    const created = await estimateVotesCasRecord(payload, advisor, {
      pledge: pledge.id,
      estimatedVotes: { pessimistic: null, central: 15, optimistic: null },
      estimateNote: null,
      baseEstimatedAt: null,
    })
    expect(created.estimatedVotes?.central).toBe(15)

    await expect(
      estimateVotesCasRecord(payload, advisor, {
        pledge: pledge.id,
        estimatedVotes: { pessimistic: null, central: 16, optimistic: null },
        estimateNote: null,
        baseEstimatedAt: null,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      const message = (error as Error).message
      expect(isOpsEstimateConflictMessage(message)).toBe(true)
      expect(parseOpsEstimateConflictServerEstimatedAt(message)).toBe(created.estimatedAt)
      return true
    })
  })
})
