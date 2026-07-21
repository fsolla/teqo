// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  declareVotesRecord,
  estimateVotesRecord,
} from '@/app/(campaign)/campanha/actions/votePledge'
import config from '@/payload.config'
import { aggregatePledgesByPlaza, loadLeaderPledges } from '@/utilities/votePledgeData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('vote pledges (declared by the leader, estimated by staff)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const createEngagedLeader = async () => {
    const fixtures = campaignFixtures()
    const plaza = await fixtures.getPlaza()
    const account = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      plazas: [plaza.id],
      user: account.id,
      supportStatus: 'engajado',
    })
    return { fixtures, plaza, account, contact, leadership }
  }

  it('lets an engaged leader declare and update votes in a linked plaza', async () => {
    const { plaza, account } = await createEngagedLeader()

    const pledge = await declareVotesRecord(payload, account, {
      plaza: plaza.id,
      declaredVotes: 150,
    })
    expect(pledge.declaredVotes).toBe(150)
    expect(pledge.declaredAt).toBeTruthy()
    campaignFixtures().own('votePledge', pledge.id)

    const updated = await declareVotesRecord(payload, account, {
      plaza: plaza.id,
      declaredVotes: 220,
    })
    expect(updated.id).toBe(pledge.id)
    expect(updated.declaredVotes).toBe(220)
  })

  it('rejects a declaration in a plaza the leadership is not linked to', async () => {
    const { account, fixtures } = await createEngagedLeader()
    const otherPlaza = await fixtures.getPlaza()

    await expect(
      declareVotesRecord(payload, account, { plaza: otherPlaza.id, declaredVotes: 10 }),
    ).rejects.toThrow('vinculada à Praça')
  })

  it('never serializes staff estimates to the leader', async () => {
    const { fixtures, plaza, account, leadership } = await createEngagedLeader()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignPlazaAdvisors(plaza.id, [advisor.id])

    const pledge = await declareVotesRecord(payload, account, {
      plaza: plaza.id,
      declaredVotes: 300,
    })
    campaignFixtures().own('votePledge', pledge.id)

    const estimated = await estimateVotesRecord(payload, advisor, {
      pledge: pledge.id,
      estimatedVotes: 120,
      estimateNote: 'Base histórica indica menos da metade.',
    })
    expect(estimated.estimatedVotes).toBe(120)
    expect(estimated.estimatedBy).toBeTruthy()

    // Leader read path (access enforced): estimated fields must be stripped.
    const leaderRead = await payload.find({
      collection: 'votePledge',
      where: { leadership: { equals: leadership.id } },
      depth: 0,
      pagination: false,
      user: account,
      overrideAccess: false,
    })
    expect(leaderRead.docs).toHaveLength(1)
    const doc = leaderRead.docs[0] as unknown as Record<string, unknown>
    expect(doc.declaredVotes).toBe(300)
    expect(doc.estimatedVotes ?? null).toBeNull()
    expect(doc.estimateNote ?? null).toBeNull()
    expect(doc.estimatedBy ?? null).toBeNull()
    expect(doc.estimatedAt ?? null).toBeNull()

    const leaderRows = await loadLeaderPledges(payload, account)
    expect(leaderRows).toHaveLength(1)
    expect(leaderRows[0]).not.toHaveProperty('estimatedVotes')
    expect(leaderRows[0]?.declaredVotes).toBe(300)
  })

  it('blocks a leader from writing the estimated fields through the Local API', async () => {
    const { fixtures, plaza, account } = await createEngagedLeader()
    const pledge = await declareVotesRecord(payload, account, {
      plaza: plaza.id,
      declaredVotes: 90,
    })
    fixtures.own('votePledge', pledge.id)

    await payload.update({
      collection: 'votePledge',
      id: pledge.id,
      data: { estimatedVotes: 9_999 } as never,
      depth: 0,
      user: account,
      overrideAccess: false,
    })

    const raw = await payload.findByID({
      collection: 'votePledge',
      id: pledge.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(raw.estimatedVotes ?? null).toBeNull()
  })

  it('scopes an advisor to pledges of administered plazas only', async () => {
    const { fixtures, plaza, account } = await createEngagedLeader()
    const pledge = await declareVotesRecord(payload, account, {
      plaza: plaza.id,
      declaredVotes: 50,
    })
    fixtures.own('votePledge', pledge.id)

    const outsideAdvisor = await fixtures.createCampaignUser('advisor')

    await expect(
      estimateVotesRecord(payload, outsideAdvisor, {
        pledge: pledge.id,
        estimatedVotes: 10,
        estimateNote: null,
      }),
    ).rejects.toThrow()

    const outsideRead = await payload.find({
      collection: 'votePledge',
      where: { id: { equals: pledge.id } },
      depth: 0,
      pagination: false,
      user: outsideAdvisor,
      overrideAccess: false,
    })
    expect(outsideRead.docs).toHaveLength(0)
  })

  it('aggregates effective votes as estimated ?? declared', async () => {
    const { fixtures, plaza, account } = await createEngagedLeader()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignPlazaAdvisors(plaza.id, [advisor.id])

    const firstPledge = await declareVotesRecord(payload, account, {
      plaza: plaza.id,
      declaredVotes: 200,
    })
    fixtures.own('votePledge', firstPledge.id)
    await estimateVotesRecord(payload, advisor, {
      pledge: firstPledge.id,
      estimatedVotes: 80,
      estimateNote: null,
    })

    const secondContact = await fixtures.createContact()
    const secondLeadership = await fixtures.createLeadership({
      contact: secondContact.id,
      plazas: [plaza.id],
      supportStatus: 'engajado',
    })
    const secondPledge = await fixtures.createVotePledge({
      leadership: secondLeadership.id,
      plaza: plaza.id,
      declaredVotes: 40,
    })

    const aggregates = await aggregatePledgesByPlaza(payload, [plaza.id])
    const aggregate = aggregates.get(plaza.id)
    expect(aggregate?.pledgeCount).toBe(2)
    expect(aggregate?.declaredTotal).toBe(240)
    expect(aggregate?.effectiveTotal).toBe(120)
    expect(aggregate?.missingEstimateCount).toBe(1)
    expect(secondPledge.declaredVotes).toBe(40)
  })
})
