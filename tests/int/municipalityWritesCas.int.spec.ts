// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createMunicipalityUpdateCasRecord,
  createMunicipalityUpdateRecord,
} from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import {
  declareVotesCasRecord,
  declareVotesRecord,
} from '@/app/(campaign)/campanha/actions/votePledge'
import {
  isOpsUpdatedAtConflictMessage,
  OPS_UPDATED_AT_CONFLICT_MESSAGE,
} from '@/lib/schemas/opsCas'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('declareVotesCas (OH10)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const createLinkedLeadership = async () => {
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
    return { fixtures, advisor, municipality, leadership }
  }

  it('writes like declareVotes when baseUpdatedAt is omitted', async () => {
    const { advisor, municipality, leadership, fixtures } = await createLinkedLeadership()

    const pledge = await declareVotesCasRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 40,
    })
    fixtures.own('votePledge', pledge.id)

    expect(pledge.declaredVotes).toBe(40)
  })

  it('refuses a stale baseUpdatedAt without writing', async () => {
    const { advisor, municipality, leadership, fixtures } = await createLinkedLeadership()

    const first = await declareVotesRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 50,
    })
    fixtures.own('votePledge', first.id)
    const baseUpdatedAt = first.updatedAt

    await declareVotesRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 75,
    })

    await expect(
      declareVotesCasRecord(payload, advisor, {
        municipality: municipality.id,
        leadership: leadership.id,
        declaredVotes: 99,
        baseUpdatedAt,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(Error)
      const message = (error as Error).message
      expect(isOpsUpdatedAtConflictMessage(message)).toBe(true)
      expect(message.startsWith(OPS_UPDATED_AT_CONFLICT_MESSAGE)).toBe(true)
      return true
    })

    const current = await payload.findByID({
      collection: 'votePledge',
      id: first.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(current.declaredVotes).toBe(75)
  })

  it('writes when baseUpdatedAt matches', async () => {
    const { advisor, municipality, leadership, fixtures } = await createLinkedLeadership()

    const first = await declareVotesRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 10,
    })
    fixtures.own('votePledge', first.id)

    const updated = await declareVotesCasRecord(payload, advisor, {
      municipality: municipality.id,
      leadership: leadership.id,
      declaredVotes: 22,
      baseUpdatedAt: first.updatedAt,
    })

    expect(updated.declaredVotes).toBe(22)
    expect(updated.updatedAt).not.toBe(first.updatedAt)
  })
})

describe('createMunicipalityUpdateCas (OH10)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('creates when baseUpdatedAt matches the parent municipality', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const parent = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
      overrideAccess: true,
    })

    const created = await createMunicipalityUpdateCasRecord(payload, advisor, {
      municipality: municipality.id,
      kind: 'nota',
      body: 'Nota CAS ok',
      baseUpdatedAt: parent.updatedAt,
    })
    fixtures.own('municipalityUpdate', created.id)

    expect(created.body).toBe('Nota CAS ok')
  })

  it('refuses a stale parent baseUpdatedAt without creating', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const parent = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
      overrideAccess: true,
    })
    const staleBase = parent.updatedAt

    // Bump parent updatedAt via a strategy-adjacent field write.
    await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { nextSteps: 'bump' },
      depth: 0,
      overrideAccess: true,
    })

    const beforeCount = await payload.count({
      collection: 'municipalityUpdate',
      where: { municipality: { equals: municipality.id } },
      overrideAccess: true,
    })

    await expect(
      createMunicipalityUpdateCasRecord(payload, advisor, {
        municipality: municipality.id,
        kind: 'nota',
        body: 'stale',
        baseUpdatedAt: staleBase,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isOpsUpdatedAtConflictMessage((error as Error).message)).toBe(true)
      return true
    })

    const afterCount = await payload.count({
      collection: 'municipalityUpdate',
      where: { municipality: { equals: municipality.id } },
      overrideAccess: true,
    })
    expect(afterCount.totalDocs).toBe(beforeCount.totalDocs)
  })

  it('creates like today when baseUpdatedAt is omitted', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const created = await createMunicipalityUpdateRecord(payload, advisor, {
      municipality: municipality.id,
      kind: 'nota',
      body: 'LWW create',
    })
    fixtures.own('municipalityUpdate', created.id)
    expect(created.body).toBe('LWW create')
  })
})
