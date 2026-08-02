// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  assignMunicipalityAdvisorsCasRecord,
  setMunicipalityAdvisorMembershipCasRecord,
  setMunicipalityEngagementLevelCasRecord,
  setMunicipalityEngagementLevelRecord,
  setMunicipalityPoliticalTrendCasRecord,
  setMunicipalityPoliticalTrendRecord,
} from '@/app/(campaign)/campanha/actions/municipality'
import { ENGAGEMENT_LEVEL_PATTERN_ID } from '@/lib/engagementLevel'
import { isOpsUpdatedAtConflictMessage } from '@/lib/schemas/opsCas'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('municipality staff CAS writes (OH10 fase 2)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('politicalTrend: refuses stale baseUpdatedAt', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const advisor = await fixtures.createCampaignUser('advisor')
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const first = await setMunicipalityPoliticalTrendRecord(payload, advisor, {
      municipality: municipality.id,
      status: 'favoravel',
      note: 'primeira',
    })
    const baseUpdatedAt = first.updatedAt

    await setMunicipalityPoliticalTrendRecord(payload, advisor, {
      municipality: municipality.id,
      status: 'neutra',
      note: 'segunda',
    })

    await expect(
      setMunicipalityPoliticalTrendCasRecord(payload, advisor, {
        municipality: municipality.id,
        status: 'desfavoravel',
        note: 'stale',
        baseUpdatedAt,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isOpsUpdatedAtConflictMessage((error as Error).message)).toBe(true)
      return true
    })

    const current = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(current.politicalTrend?.status).toBe('neutra')
    expect(current.politicalTrend?.note).toBe('segunda')
  })

  it('engagement: matching CAS writes level + allocationDecision in one transaction', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const parent = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
      overrideAccess: true,
    })

    const updated = await setMunicipalityEngagementLevelCasRecord(payload, coordinator, {
      municipality: municipality.id,
      level: 'n1',
      note: 'Motivo CAS',
      reversalSignals: 'Sinais de reversão',
      triangulatedShock: false,
      override: false,
      baseUpdatedAt: parent.updatedAt,
    })
    fixtures.touchMunicipality(municipality.id)

    expect(updated.engagementLevel).toBe('n1')

    const decisions = await payload.find({
      collection: 'allocationDecision',
      where: {
        and: [
          { municipality: { equals: municipality.id } },
          { patternId: { equals: ENGAGEMENT_LEVEL_PATTERN_ID } },
        ],
      },
      depth: 0,
      limit: 5,
      sort: '-createdAt',
      overrideAccess: true,
    })
    fixtures.own('allocationDecision', decisions.docs[0]!.id)
    expect(decisions.docs[0]?.rationale).toBe('Motivo CAS')
    expect(decisions.docs[0]?.outcome).toBe('movimento')
  })

  it('engagement: stale CAS refuses without writing a decision', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const first = await setMunicipalityEngagementLevelRecord(payload, coordinator, {
      municipality: municipality.id,
      level: 'n0',
      note: 'Primeiro movimento',
      reversalSignals: 'Sinais',
      triangulatedShock: false,
      override: false,
    })
    const staleBase = first.updatedAt

    await setMunicipalityEngagementLevelRecord(payload, coordinator, {
      municipality: municipality.id,
      level: 'n1',
      note: 'Segundo movimento',
      reversalSignals: 'Sinais 2',
      triangulatedShock: false,
      override: true,
    })
    fixtures.touchMunicipality(municipality.id)

    const beforeCount = await payload.count({
      collection: 'allocationDecision',
      where: {
        and: [
          { municipality: { equals: municipality.id } },
          { patternId: { equals: ENGAGEMENT_LEVEL_PATTERN_ID } },
        ],
      },
      overrideAccess: true,
    })

    await expect(
      setMunicipalityEngagementLevelCasRecord(payload, coordinator, {
        municipality: municipality.id,
        level: 'n2',
        note: 'Stale',
        reversalSignals: 'x',
        triangulatedShock: false,
        override: true,
        baseUpdatedAt: staleBase,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isOpsUpdatedAtConflictMessage((error as Error).message)).toBe(true)
      return true
    })

    const afterCount = await payload.count({
      collection: 'allocationDecision',
      where: {
        and: [
          { municipality: { equals: municipality.id } },
          { patternId: { equals: ENGAGEMENT_LEVEL_PATTERN_ID } },
        ],
      },
      overrideAccess: true,
    })
    expect(afterCount.totalDocs).toBe(beforeCount.totalDocs)

    const current = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(current.engagementLevel).toBe('n1')
  })

  it('advisors assignment: refuses stale baseUpdatedAt', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisorA = await fixtures.createCampaignUser('advisor')
    const advisorB = await fixtures.createCampaignUser('advisor')

    const first = await assignMunicipalityAdvisorsCasRecord(payload, coordinator, {
      municipality: municipality.id,
      advisors: [advisorA.id],
    })
    const staleBase = first.updatedAt

    await assignMunicipalityAdvisorsCasRecord(payload, coordinator, {
      municipality: municipality.id,
      advisors: [advisorB.id],
      baseUpdatedAt: first.updatedAt,
    })

    await expect(
      assignMunicipalityAdvisorsCasRecord(payload, coordinator, {
        municipality: municipality.id,
        advisors: [advisorA.id, advisorB.id],
        baseUpdatedAt: staleBase,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isOpsUpdatedAtConflictMessage((error as Error).message)).toBe(true)
      return true
    })
  })

  it('advisor membership: matching CAS toggles one advisor', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')

    const parent = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
      overrideAccess: true,
    })

    const updated = await setMunicipalityAdvisorMembershipCasRecord(payload, coordinator, {
      municipality: municipality.id,
      advisor: advisor.id,
      assigned: true,
      baseUpdatedAt: parent.updatedAt,
    })

    expect(updated.advisors).toEqual(expect.arrayContaining([advisor.id]))
  })
})
