// @vitest-environment node

/**
 * Thin smokes for the five entity list loaders ahead of the Pass 2 list-system
 * consolidation (W1): scope (role access), marker-narrowed search and the
 * pagination shape every list page consumes ({ rows, totalDocs, totalPages }).
 */
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadAdvisorListPageData } from '@/utilities/advisorData'
import { loadDemandListPageData } from '@/utilities/campaignDemandData'
import { loadLeadershipListPageData } from '@/utilities/leadershipData'
import { loadOrganizationListPageData } from '@/utilities/organizationData'
import { loadStateDeputyListPageData } from '@/utilities/stateDeputyData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

describe('loadLeadershipListPageData', () => {
  it('returns marker-scoped rows with municipality names for staff', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    await fixtures.createLeadership({ contact: contact.id, municipalities: [municipality.id] })

    const result = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: contact.name,
    })

    expect(result.totalDocs).toBe(1)
    expect(result.totalPages).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      name: contact.name,
      municipalityNames: [municipality.name],
      hasAppAccess: false,
    })
  })

  it('short-circuits to an empty page when no contact matches the query', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: fixtures.value('sem-resultado'),
    })

    expect(result).toEqual({ rows: [], totalDocs: 0, totalPages: 0 })
  })

  it('returns an empty page for leaders (staff guard, no throw)', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    const result = await loadLeadershipListPageData(payload, leader, { page: 1 })

    expect(result).toEqual({ rows: [], totalDocs: 0, totalPages: 0 })
  })
})

describe('loadOrganizationListPageData', () => {
  it('narrows by q and kind and counts linked leaderships', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const organization = await fixtures.createOrganization({
      kind: 'associacao',
      municipalities: [municipality.id],
    })
    const contact = await fixtures.createContact()
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      organizations: [organization.id],
    })

    const match = await loadOrganizationListPageData(payload, coordinator, {
      page: 1,
      q: organization.name,
      kind: 'associacao',
    })
    expect(match.totalDocs).toBe(1)
    expect(match.rows[0]).toMatchObject({
      slug: organization.slug,
      kind: 'associacao',
      municipalityNames: [municipality.name],
      leadershipCount: 1,
    })

    const kindMiss = await loadOrganizationListPageData(payload, coordinator, {
      page: 1,
      q: organization.name,
      kind: 'sindicato',
    })
    expect(kindMiss.totalDocs).toBe(0)
    expect(kindMiss.rows).toEqual([])
  })
})

describe('loadStateDeputyListPageData', () => {
  it('narrows by q with zeroed relation counts for a fresh deputy', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy({ party: 'PT' })

    const result = await loadStateDeputyListPageData(payload, coordinator, {
      page: 1,
      q: stateDeputy.name,
    })

    expect(result.totalDocs).toBe(1)
    expect(result.totalPages).toBe(1)
    expect(result.rows[0]).toMatchObject({
      slug: stateDeputy.slug,
      party: 'PT',
      municipalityCount: 0,
      leadershipCount: 0,
    })
  })
})

describe('loadDemandListPageData', () => {
  it('lists staff demands with municipality labels, open count and status filter', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const demand = await fixtures.createCampaignDemand({
      municipality: municipality.id,
      status: 'aberta',
    })

    const open = await loadDemandListPageData(payload, coordinator, {
      page: 1,
      status: 'aberta',
    })
    const row = open.rows.find((candidate) => candidate.slug === demand.slug)
    expect(row).toMatchObject({
      title: demand.title,
      status: 'aberta',
      municipalityName: municipality.name,
      municipalitySlug: municipality.slug,
    })
    expect(open.openCount).toBeGreaterThanOrEqual(1)
    expect(open.totalPages).toBeGreaterThanOrEqual(1)

    const closed = await loadDemandListPageData(payload, coordinator, {
      page: 1,
      status: 'rejeitada',
    })
    expect(closed.rows.some((candidate) => candidate.slug === demand.slug)).toBe(false)
  })

  it('rejects leaders (demands are staff-only)', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    await expect(loadDemandListPageData(payload, leader, { page: 1 })).rejects.toThrow(/permissão/i)
  })
})

describe('loadAdvisorListPageData', () => {
  it('lists only advisor accounts, narrowed by q, with portfolio municipalities', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    // A coordinator sharing the marker must not appear (role filter).
    await fixtures.createCampaignUser('coordinator', {
      name: `${advisor.name} coordenando`,
    })
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality.id, [advisor.id])

    const result = await loadAdvisorListPageData(payload, { page: 1, q: advisor.name })

    expect(result.totalDocs).toBe(1)
    expect(result.rows[0]).toMatchObject({ id: advisor.id, name: advisor.name })
    expect(result.rows[0]!.municipalities).toEqual([
      { id: municipality.id, name: municipality.name, slug: municipality.slug },
    ])
  })
})
