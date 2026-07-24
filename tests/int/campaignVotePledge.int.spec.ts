// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  declareVotesRecord,
  estimateVotesRecord,
} from '@/app/(campaign)/campanha/actions/votePledge'
import config from '@/payload.config'
import { aggregatePledgesByMunicipality } from '@/utilities/votePledgeData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('vote pledges (declared by staff, estimated by staff)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const createEngagedLeadership = async () => {
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
    return { fixtures, municipality, advisor, contact, leadership }
  }

  it('lets staff declare and update votes for a linked leadership', async () => {
    const { municipality, advisor, leadership } = await createEngagedLeadership()

    const pledge = await declareVotesRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 150,
    })
    expect(pledge.declaredVotes).toBe(150)
    expect(pledge.declaredAt).toBeTruthy()
    campaignFixtures().own('votePledge', pledge.id)

    const updated = await declareVotesRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 220,
    })
    expect(updated.id).toBe(pledge.id)
    expect(updated.declaredVotes).toBe(220)
  })

  it('rejects a declaration in a municipality the leadership is not linked to', async () => {
    const { advisor, fixtures, leadership } = await createEngagedLeadership()
    const otherMunicipality = await fixtures.getMunicipality()

    await expect(
      declareVotesRecord(payload, advisor, {
        municipality: otherMunicipality.id,
        leadership: leadership.id,
        declaredVotes: 10,
      }),
    ).rejects.toThrow('vinculada ao município')
  })

  it('blocks leaders from declaring votes', async () => {
    const { municipality, fixtures } = await createEngagedLeadership()
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    await expect(
      declareVotesRecord(payload, leaderAccount, {
        municipality: municipality.id,
        leadership: leadership.id,
        declaredVotes: 50,
      }),
    ).rejects.toThrow('coordenação e a assessoria')
  })

  it('never exposes staff estimates to leaders through read access', async () => {
    const { fixtures, municipality, advisor, leadership } = await createEngagedLeadership()
    const leaderAccount = await fixtures.createCampaignUser('leader')
    await fixtures.createLeadership({
      contact: await fixtures.createContact(),
      municipalities: [municipality.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    const pledge = await declareVotesRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 300,
    })
    campaignFixtures().own('votePledge', pledge.id)

    const estimated = await estimateVotesRecord(payload, advisor, {
      pledge: pledge.id,
      estimatedVotes: { pessimistic: null, central: 120, optimistic: null },
      estimateNote: 'Base histórica indica menos da metade.',
    })
    expect(estimated.estimatedVotes?.central).toBe(120)

    await expect(
      payload.find({
        collection: 'votePledge',
        where: { id: { equals: pledge.id } },
        depth: 0,
        pagination: false,
        user: leaderAccount,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão/i)
  })

  it('scopes an advisor to pledges of administered municipalities only', async () => {
    const { fixtures, municipality, advisor, leadership } = await createEngagedLeadership()
    const pledge = await declareVotesRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 50,
    })
    fixtures.own('votePledge', pledge.id)

    const outsideAdvisor = await fixtures.createCampaignUser('advisor')

    await expect(
      estimateVotesRecord(payload, outsideAdvisor, {
        pledge: pledge.id,
        estimatedVotes: { pessimistic: null, central: 10, optimistic: null },
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

  it('lets the candidate read and estimate pledges across municipalities', async () => {
    const { fixtures, municipality, advisor, leadership } = await createEngagedLeadership()
    const candidate = await fixtures.createCampaignUser('candidate')

    const pledge = await declareVotesRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 90,
    })
    fixtures.own('votePledge', pledge.id)

    const candidateRead = await payload.find({
      collection: 'votePledge',
      where: { id: { equals: pledge.id } },
      depth: 0,
      pagination: false,
      user: candidate,
      overrideAccess: false,
    })
    expect(candidateRead.docs).toHaveLength(1)

    const estimated = await estimateVotesRecord(payload, candidate, {
      pledge: pledge.id,
      estimatedVotes: { pessimistic: null, central: 45, optimistic: null },
      estimateNote: null,
    })
    expect(estimated.estimatedVotes?.central).toBe(45)
  })

  it('aggregates effective votes as estimated ?? declared', async () => {
    const { fixtures, municipality, advisor, leadership } = await createEngagedLeadership()

    const firstPledge = await declareVotesRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 200,
    })
    fixtures.own('votePledge', firstPledge.id)
    await estimateVotesRecord(payload, advisor, {
      pledge: firstPledge.id,
      estimatedVotes: { pessimistic: null, central: 80, optimistic: null },
      estimateNote: null,
    })

    const secondContact = await fixtures.createContact()
    const secondLeadership = await fixtures.createLeadership({
      contact: secondContact.id,
      municipalities: [municipality.id],
      supportStatus: 'engajado',
    })
    const secondPledge = await fixtures.createVotePledge({
      leadership: secondLeadership.id,
      municipality: municipality.id,
      declaredVotes: 40,
    })

    const aggregates = await aggregatePledgesByMunicipality(payload, [municipality.id])
    const aggregate = aggregates.get(municipality.id)
    expect(aggregate?.pledgeCount).toBe(2)
    expect(aggregate?.declaredTotal).toBe(240)
    expect(aggregate?.effectiveByScenario.central).toBe(120)
    expect(aggregate?.missingEstimateCount).toBe(1)
    expect(secondPledge.declaredVotes).toBe(40)
  })
})
