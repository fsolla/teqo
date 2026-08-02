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
import { loadLeadershipListPageData } from '@/utilities/leadership/leadershipData'
import { loadOrganizationListPageData } from '@/utilities/organizationData'
import { loadStateDeputyListPageData } from '@/utilities/stateDeputyData'
import { NO_PARTY_FILTER_VALUE } from '@/utilities/stateDeputyListUrl'

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
  it('returns marker-scoped rows with municipality ids for staff', async () => {
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
      municipalityIDs: [municipality.id],
      hasAppAccess: false,
    })
    expect(result.filterFacets.municipalityIDs).toContain(municipality.id)
  })

  it('short-circuits to an empty page when no contact matches the query', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: fixtures.value('sem-resultado'),
    })

    expect(result).toEqual({
      rows: [],
      totalDocs: 0,
      totalPages: 0,
      filterFacets: { municipalityIDs: [], organizationIDs: [], stateDeputyIDs: [] },
    })
  })

  it('returns an empty page for leaders (staff guard, no throw)', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    const result = await loadLeadershipListPageData(payload, leader, { page: 1 })

    expect(result).toEqual({
      rows: [],
      totalDocs: 0,
      totalPages: 0,
      filterFacets: { municipalityIDs: [], organizationIDs: [], stateDeputyIDs: [] },
    })
  })

  it('filters by organization with inclusive OR within the dimension', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const marker = fixtures.value('lead-org-filter')
    const organizationA = await fixtures.createOrganization({ name: `Org A ${marker}` })
    const organizationB = await fixtures.createOrganization({ name: `Org B ${marker}` })
    const matchContact = await fixtures.createContact({ name: `Ana ${marker}` })
    const missContact = await fixtures.createContact({ name: `Bruno ${marker}` })
    const match = await fixtures.createLeadership({
      contact: matchContact.id,
      municipalities: [municipality.id],
      organizations: [organizationA.id],
    })
    await fixtures.createLeadership({
      contact: missContact.id,
      municipalities: [municipality.id],
      organizations: [organizationB.id],
    })

    const byOrganization = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      organizations: [organizationA.id],
    })
    expect(byOrganization.rows.map((row) => row.id)).toEqual([match.id])
    expect(byOrganization.filterFacets.organizationIDs).toContain(organizationA.id)
    expect(byOrganization.filterFacets.organizationIDs).toContain(organizationB.id)
  })

  it('filters by supportStatus, access and municipality', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipalityA = await fixtures.getMunicipality()
    const municipalityB = await fixtures.getMunicipality()
    const marker = fixtures.value('lead-filter')

    const matchContact = await fixtures.createContact({ name: `Ana ${marker}` })
    const missContact = await fixtures.createContact({ name: `Bruno ${marker}` })
    const match = await fixtures.createLeadership({
      contact: matchContact.id,
      municipalities: [municipalityA.id],
      supportStatus: 'a_abordar',
    })
    await fixtures.createLeadership({
      contact: missContact.id,
      municipalities: [municipalityB.id],
      supportStatus: 'engajado',
    })

    const byStatus = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      statuses: ['a_abordar'],
    })
    expect(byStatus.rows.map((row) => row.id)).toEqual([match.id])

    const byMunicipality = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      municipalities: [municipalityA.id],
    })
    expect(byMunicipality.rows.map((row) => row.id)).toEqual([match.id])

    const withoutAccess = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      access: 'sem',
    })
    expect(withoutAccess.totalDocs).toBe(2)
    expect(withoutAccess.rows.every((row) => !row.hasAppAccess)).toBe(true)

    const withAccess = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      access: 'com',
    })
    expect(withAccess.totalDocs).toBe(0)
  })

  it('sorts by contact.name in both directions via the dotted join path', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const marker = fixtures.value('lead-sort')
    const alpha = await fixtures.createContact({ name: `Aaa ${marker}` })
    const omega = await fixtures.createContact({ name: `Zzz ${marker}` })
    const first = await fixtures.createLeadership({
      contact: alpha.id,
      municipalities: [municipality.id],
    })
    const last = await fixtures.createLeadership({
      contact: omega.id,
      municipalities: [municipality.id],
    })

    const asc = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      sort: 'name',
      dir: 'asc',
    })
    expect(asc.rows.map((row) => row.id)).toEqual([first.id, last.id])

    const desc = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      sort: 'name',
      dir: 'desc',
    })
    expect(desc.rows.map((row) => row.id)).toEqual([last.id, first.id])
  })

  it('keeps the municipality facet reachable under other filters and unions the selection', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipalityA = await fixtures.getMunicipality()
    const municipalityB = await fixtures.getMunicipality()
    const marker = fixtures.value('lead-facet')
    await fixtures.createLeadership({
      contact: (await fixtures.createContact({ name: `A ${marker}` })).id,
      municipalities: [municipalityA.id],
      supportStatus: 'a_abordar',
    })
    await fixtures.createLeadership({
      contact: (await fixtures.createContact({ name: `B ${marker}` })).id,
      municipalities: [municipalityB.id],
      supportStatus: 'engajado',
    })

    const unfiltered = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: marker,
    })
    expect(unfiltered.filterFacets.municipalityIDs).toEqual(
      expect.arrayContaining([municipalityA.id, municipalityB.id]),
    )

    const filtered = await loadLeadershipListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      statuses: ['a_abordar'],
      municipalities: [municipalityB.id],
    })
    // Own filter ignored for the facet — A stays; B stays because it is selected.
    expect(filtered.filterFacets.municipalityIDs).toEqual(
      expect.arrayContaining([municipalityA.id, municipalityB.id]),
    )
  })

  it('does not leak out-of-scope leaderships to an advisor even with a foreign municipality filter', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const inScope = await fixtures.getMunicipality()
    const outOfScope = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(inScope.id, [advisor.id])

    const marker = fixtures.value('lead-scope')
    const visible = await fixtures.createLeadership({
      contact: (await fixtures.createContact({ name: `In ${marker}` })).id,
      municipalities: [inScope.id],
    })
    await fixtures.createLeadership({
      contact: (await fixtures.createContact({ name: `Out ${marker}` })).id,
      municipalities: [outOfScope.id],
    })

    const foreignFilter = await loadLeadershipListPageData(payload, advisor, {
      page: 1,
      q: marker,
      municipalities: [outOfScope.id],
    })
    expect(foreignFilter.totalDocs).toBe(0)
    expect(foreignFilter.rows).toEqual([])

    const scoped = await loadLeadershipListPageData(payload, advisor, {
      page: 1,
      q: marker,
    })
    expect(scoped.rows.map((row) => row.id)).toEqual([visible.id])
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
      municipalityIDs: [],
      leaderships: [],
    })
  })

  it('resolves named leaderships linked to the deputy (not a bare count)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const stateDeputy = await fixtures.createStateDeputy({ party: 'PT' })
    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
    })
    await payload.update({
      collection: 'leadership',
      id: leadership.id,
      data: { stateDeputies: [stateDeputy.id] },
      depth: 0,
      overrideAccess: true,
    })

    const result = await loadStateDeputyListPageData(payload, coordinator, {
      page: 1,
      q: stateDeputy.name,
    })

    expect(result.rows[0]).toMatchObject({
      slug: stateDeputy.slug,
      leaderships: [{ id: leadership.id, name: contact.name }],
    })
  })

  it('sorts by party in both directions, pinning where the party-less row falls', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const marker = fixtures.value('sort')
    const withPsd = await fixtures.createStateDeputy({
      name: `Dep ${marker} PSD`,
      party: 'PSD',
    })
    const withPt = await fixtures.createStateDeputy({ name: `Dep ${marker} PT`, party: 'PT' })
    const withoutParty = await fixtures.createStateDeputy({ name: `Dep ${marker} sem` })

    // Pinned adapter behavior (Postgres default, unmodified by Payload): ASC
    // sorts nulls LAST, DESC sorts nulls FIRST — the party-less row never
    // lands in the middle. "Sem partido" is the direct, unambiguous path to
    // find it either way.
    const asc = await loadStateDeputyListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      sort: 'party',
      dir: 'asc',
    })
    expect(asc.rows.map((row) => row.slug)).toEqual([withPsd.slug, withPt.slug, withoutParty.slug])

    const desc = await loadStateDeputyListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      sort: 'party',
      dir: 'desc',
    })
    expect(desc.rows.map((row) => row.slug)).toEqual([withoutParty.slug, withPt.slug, withPsd.slug])
  })

  it('filters by selected parties and by the "Sem partido" sentinel', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const marker = fixtures.value('filter')
    const withPt = await fixtures.createStateDeputy({ name: `Dep ${marker} PT`, party: 'PT' })
    await fixtures.createStateDeputy({ name: `Dep ${marker} PSD`, party: 'PSD' })
    const withoutParty = await fixtures.createStateDeputy({ name: `Dep ${marker} sem` })

    const byParty = await loadStateDeputyListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      parties: ['PT'],
    })
    expect(byParty.rows.map((row) => row.slug)).toEqual([withPt.slug])

    const byNoParty = await loadStateDeputyListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      parties: [NO_PARTY_FILTER_VALUE],
    })
    expect(byNoParty.rows.map((row) => row.slug)).toEqual([withoutParty.slug])
  })

  it('computes the party facet from the current search, ignoring the party filter itself', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const marker = fixtures.value('facet')
    await fixtures.createStateDeputy({ name: `Dep ${marker} PT`, party: 'PT' })
    await fixtures.createStateDeputy({ name: `Dep ${marker} PSD`, party: 'PSD' })
    await fixtures.createStateDeputy({ name: `Dep ${marker} sem` })

    const unfiltered = await loadStateDeputyListPageData(payload, coordinator, {
      page: 1,
      q: marker,
    })
    expect(unfiltered.filterFacets).toEqual({ parties: ['PSD', 'PT'], hasNoParty: true })

    // Selecting PT keeps every party option reachable — the facet ignores its
    // own popover's filter so the other options remain visible to switch to.
    const filteredByPt = await loadStateDeputyListPageData(payload, coordinator, {
      page: 1,
      q: marker,
      parties: ['PT'],
    })
    expect(filteredByPt.filterFacets).toEqual({ parties: ['PSD', 'PT'], hasNoParty: true })
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

  it('narrows by free-text search on title and requester name', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const marker = fixtures.value('demand-q')

    const contact = await fixtures.createContact({ name: `${marker} solicitante` })
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
    })

    const byTitle = await fixtures.createCampaignDemand({
      municipality: municipality.id,
      title: `${marker} banner comitê`,
    })
    const byRequester = await fixtures.createCampaignDemand({
      municipality: municipality.id,
      leadership: leadership.id,
      title: `${marker} outra demanda`,
    })
    await fixtures.createCampaignDemand({
      municipality: municipality.id,
      title: `${marker} sem match`,
    })

    const titleHits = await loadDemandListPageData(payload, coordinator, {
      page: 1,
      q: 'banner comitê',
    })
    expect(titleHits.rows.some((row) => row.slug === byTitle.slug)).toBe(true)
    expect(titleHits.rows.some((row) => row.slug === byRequester.slug)).toBe(false)

    const requesterHits = await loadDemandListPageData(payload, coordinator, {
      page: 1,
      q: 'solicitante',
    })
    expect(requesterHits.rows.some((row) => row.slug === byRequester.slug)).toBe(true)
    expect(requesterHits.rows.some((row) => row.slug === byTitle.slug)).toBe(false)

    const noMatch = await loadDemandListPageData(payload, coordinator, {
      page: 1,
      q: 'zzznomatch',
    })
    expect(noMatch.rows.some((row) => row.slug === byTitle.slug)).toBe(false)
    expect(noMatch.rows.some((row) => row.slug === byRequester.slug)).toBe(false)
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
    // Ids only: the list's chips resolve their labels from the static catalog.
    expect(result.rows[0]!.municipalityIDs).toEqual([municipality.id])
  })

  it('narrows by municipality portfolio with OR semantics', async () => {
    const fixtures = campaignFixtures()
    const advisorA = await fixtures.createCampaignUser('advisor')
    const advisorB = await fixtures.createCampaignUser('advisor')
    const municipalityA = await fixtures.getMunicipality()
    const municipalityB = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipalityA.id, [advisorA.id])
    await fixtures.assignMunicipalityAdvisors(municipalityB.id, [advisorB.id])

    const onlyA = await loadAdvisorListPageData(payload, {
      page: 1,
      municipalities: [municipalityA.id],
    })
    expect(onlyA.totalDocs).toBe(1)
    expect(onlyA.rows[0]?.id).toBe(advisorA.id)

    const either = await loadAdvisorListPageData(payload, {
      page: 1,
      municipalities: [municipalityA.id, municipalityB.id],
    })
    expect(either.totalDocs).toBe(2)
    expect(either.rows.map((row) => row.id).sort()).toEqual([advisorA.id, advisorB.id].sort())

    const none = await loadAdvisorListPageData(payload, {
      page: 1,
      municipalities: [999_999],
    })
    expect(none.totalDocs).toBe(0)
  })
})
