// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { getMunicipalityCatalogEntry, municipalityCatalog } from '@/lib/municipalityCatalog'
import config from '@/payload.config'
import { loadMunicipalityListPageBundle } from '@/utilities/municipalityPageData'
import { computeMunicipalityTerritorialClass } from '@/utilities/municipalityTerritorialClass'
import { aggregatePledgesByMunicipality } from '@/utilities/votePledgeData'
import { rollupMunicipalityStaffVotes } from '@/utilities/votePledgeViews'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('loadMunicipalityListPageBundle', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('keeps a zeroed overview when the filtered municipality set is empty', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    const bundle = await loadMunicipalityListPageBundle(payload, coordinator, { q: 'zzznomatch' })

    // The overview stays on screen next to the empty state instead of unmounting.
    expect(bundle.municipalities).toHaveLength(0)
    expect(bundle.overview).not.toBeNull()
    expect(bundle.overview!.municipalityCount).toBe(0)
    expect(bundle.overview!.staffVoteTotalByScenario.central).toBe(0)
    expect(bundle.overview!.goalCoverageByScenario.central.goal).toBe(0)
  })

  it('rolls up staffVoteTotal from expectedVotes when no pledge overrides apply', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    fixtures.touchMunicipality(municipality.id)

    await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { expectedVotes: { pessimistic: null, central: 1_500, optimistic: null } },
      depth: 0,
      overrideAccess: true,
    })

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'engajado',
    })
    await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: municipality.id,
      declaredVotes: 80,
      estimatedVotes: { pessimistic: null, central: 120, optimistic: null },
    })

    const refreshedMunicipality = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
      overrideAccess: true,
    })
    const aggregates = await aggregatePledgesByMunicipality(payload, [municipality.id])
    const rollup = rollupMunicipalityStaffVotes([refreshedMunicipality], aggregates)
    expect(rollup.staffVoteTotal).toBe(1_500)

    const bundle = await loadMunicipalityListPageBundle(payload, coordinator, {
      q: municipality.name,
    })

    expect(bundle.overview).not.toBeNull()
    expect(bundle.overview!.staffVoteTotalByScenario.central).toBeGreaterThanOrEqual(1_500)
    const row = bundle.municipalities.find((item) => item.slug === municipality.slug)
    expect(row?.votePosition2022).not.toBeNull()
    expect(row!.votePosition2022!.totalUnits).toBe(435)
    expect(row!.votePosition2022!.rank).toBeGreaterThanOrEqual(1)
  })

  it('orders the filtered set by 2022 votes when sort=votos', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const first = await fixtures.getMunicipality()
    const second = await fixtures.getMunicipality()
    fixtures.touchMunicipality(first.id)
    fixtures.touchMunicipality(second.id)

    const marker = `a11-votos-${Date.now()}`
    await payload.update({
      collection: 'municipality',
      id: first.id,
      data: { name: `${marker}-alpha` },
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'municipality',
      id: second.id,
      data: { name: `${marker}-beta` },
      depth: 0,
      overrideAccess: true,
    })

    const bundle = await loadMunicipalityListPageBundle(payload, coordinator, {
      q: marker,
      sort: 'votos',
    })

    expect(bundle.municipalities.length).toBeGreaterThanOrEqual(2)
    const votes = bundle.municipalities.map((row) => row.votePosition2022?.votes ?? 0)
    const nonZero = votes.filter((value) => value > 0)
    for (let index = 1; index < nonZero.length; index += 1) {
      expect(nonZero[index - 1]!).toBeGreaterThanOrEqual(nonZero[index]!)
    }
    // Zeros (if any) must trail the non-zero block.
    const firstZero = votes.findIndex((value) => value === 0)
    if (firstZero >= 0) {
      expect(votes.slice(firstZero).every((value) => value === 0)).toBe(true)
    }
  })

  /**
   * E9 allocation queue: the default ordering. Uses `expectedVotes` (mesa
   * goals) so the deficits are pinned by the fixture instead of by whatever
   * the 2022 artifact says for the allocated slugs.
   */
  it('orders by uncovered deficit (default sort), biggest gap first', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const wideGap = await fixtures.getMunicipality()
    const nearlyCovered = await fixtures.getMunicipality()

    const marker = `e9-deficit-${Date.now()}`
    await payload.update({
      collection: 'municipality',
      id: wideGap.id,
      data: {
        name: `${marker}-wide`,
        expectedVotes: { pessimistic: null, central: 5_000, optimistic: null },
      },
      depth: 0,
      overrideAccess: true,
    })
    fixtures.touchMunicipality(wideGap.id)
    await payload.update({
      collection: 'municipality',
      id: nearlyCovered.id,
      data: {
        name: `${marker}-near`,
        expectedVotes: { pessimistic: null, central: 1_000, optimistic: null },
      },
      depth: 0,
      overrideAccess: true,
    })
    fixtures.touchMunicipality(nearlyCovered.id)

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [nearlyCovered.id],
      supportStatus: 'engajado',
    })
    await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: nearlyCovered.id,
      declaredVotes: 900,
      estimatedVotes: { pessimistic: null, central: 900, optimistic: null },
    })

    const descending = await loadMunicipalityListPageBundle(payload, coordinator, { q: marker })
    expect(descending.municipalities.map((row) => row.slug)).toEqual([
      wideGap.slug,
      nearlyCovered.slug,
    ])
    expect(descending.municipalities[0]!.goalCoverageByScenario.central.deficit).toBe(5_000)
    expect(descending.municipalities[1]!.goalCoverageByScenario.central.deficit).toBe(100)

    const ascending = await loadMunicipalityListPageBundle(payload, coordinator, {
      q: marker,
      sort: 'deficit',
      dir: 'asc',
    })
    expect(ascending.municipalities.map((row) => row.slug)).toEqual([
      nearlyCovered.slug,
      wideGap.slug,
    ])
  })

  it('orders by frescor with "never had a signal" ahead of the oldest signal', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const silent = await fixtures.getMunicipality()
    const touched = await fixtures.getMunicipality()

    const marker = `e9-frescor-${Date.now()}`
    await payload.update({
      collection: 'municipality',
      id: silent.id,
      data: { name: `${marker}-silent`, lastUpdateAt: null },
      depth: 0,
      overrideAccess: true,
    })
    fixtures.touchMunicipality(silent.id)
    await payload.update({
      collection: 'municipality',
      id: touched.id,
      data: { name: `${marker}-touched` },
      depth: 0,
      overrideAccess: true,
    })
    // The collection hook recomputes `lastUpdateAt` from this update.
    await fixtures.createMunicipalityUpdate({
      municipality: touched.id,
      author: coordinator.id,
    })

    const coldestFirst = await loadMunicipalityListPageBundle(payload, coordinator, {
      q: marker,
      sort: 'frescor',
    })
    expect(coldestFirst.municipalities.map((row) => row.slug)).toEqual([silent.slug, touched.slug])
    expect(coldestFirst.municipalities[0]!.lastSignalAt).toBeNull()
    expect(coldestFirst.municipalities[1]!.lastSignalAt).not.toBeNull()

    const freshestFirst = await loadMunicipalityListPageBundle(payload, coordinator, {
      q: marker,
      sort: 'frescor',
      dir: 'asc',
    })
    expect(freshestFirst.municipalities.map((row) => row.slug)).toEqual([touched.slug, silent.slug])
  })

  it('counts a pledge date as a signal even when no staff update exists', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    fixtures.touchMunicipality(municipality.id)

    const marker = `e9-pledge-signal-${Date.now()}`
    await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { name: marker, lastUpdateAt: null },
      depth: 0,
      overrideAccess: true,
    })

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'engajado',
    })
    // `declaredAt` is stamped by the collection's own beforeChange hook, so the
    // fixture cannot pin it — read it back and assert the signal matches.
    const pledge = await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: municipality.id,
      declaredVotes: 50,
    })
    expect(pledge.declaredAt).toBeTruthy()

    const bundle = await loadMunicipalityListPageBundle(payload, coordinator, { q: marker })
    const row = bundle.municipalities.find((item) => item.slug === municipality.slug)
    expect(row?.lastUpdateAt).toBeNull()
    expect(row?.lastSignalAt).toBe(pledge.declaredAt)
    expect(row?.pledges.lastPledgeAt).toBe(pledge.declaredAt)
  })

  /**
   * E10: the class is derived from the committed TSE artifact, so the filter
   * cannot be a Payload constraint. The bundle must still agree with itself —
   * rows, `totalDocs` and the overview all counting the filtered scope.
   */
  it('filters by the derived territorial class and keeps the overview honest', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const redutoEntry = municipalityCatalog.find(
      (entry) => computeMunicipalityTerritorialClass(entry.slug).class === 'reduto',
    )!
    const marginalEntry = municipalityCatalog.find(
      (entry) => computeMunicipalityTerritorialClass(entry.slug).class === 'marginal',
    )!
    const reduto = await fixtures.getMunicipality(redutoEntry.slug)
    const marginal = await fixtures.getMunicipality(marginalEntry.slug)

    const marker = `e10-classe-${Date.now()}`
    for (const [municipality, suffix] of [
      [reduto, 'reduto'],
      [marginal, 'marginal'],
    ] as const) {
      await payload.update({
        collection: 'municipality',
        id: municipality.id,
        data: { name: `${marker}-${suffix}` },
        depth: 0,
        overrideAccess: true,
      })
      fixtures.touchMunicipality(municipality.id)
    }

    const filtered = await loadMunicipalityListPageBundle(payload, coordinator, {
      q: marker,
      class: 'reduto',
    })
    expect(filtered.municipalities.map((row) => row.slug)).toEqual([reduto.slug])
    expect(filtered.totalDocs).toBe(1)
    expect(filtered.overview?.municipalityCount).toBe(1)
    expect(filtered.municipalities[0]!.territorialClass).toBe('reduto')
    expect(filtered.municipalities[0]!.territorialClassFactors.length).toBeGreaterThan(0)

    // A native sort key would otherwise let Payload paginate before the class
    // filter runs, which would hand back a short page with an inflated total.
    const byName = await loadMunicipalityListPageBundle(payload, coordinator, {
      q: marker,
      class: 'reduto',
      sort: 'name',
    })
    expect(byName.municipalities.map((row) => row.slug)).toEqual([reduto.slug])
    expect(byName.totalDocs).toBe(1)

    const sorted = await loadMunicipalityListPageBundle(payload, coordinator, {
      q: marker,
      sort: 'classe',
    })
    expect(sorted.municipalities.map((row) => row.slug)).toEqual([reduto.slug, marginal.slug])
  })

  it('keeps advisor access and applies URL filters on top', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const included = await loadMunicipalityListPageBundle(payload, advisor, {
      q: administered.name,
    })
    expect(included.overview).not.toBeNull()
    expect(included.municipalities.some((row) => row.slug === administered.slug)).toBe(true)

    const excluded =
      administered.kind === 'zona'
        ? await loadMunicipalityListPageBundle(payload, advisor, { kind: 'municipio' })
        : await loadMunicipalityListPageBundle(payload, advisor, { kind: 'zona' })
    expect(excluded.overview?.municipalityCount).toBe(0)
    expect(excluded.municipalities).toHaveLength(0)
  })

  it('cross-filters column-filter options but never narrows a filter by itself', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const catalogEntry = getMunicipalityCatalogEntry(municipality.slug)
    expect(catalogEntry).toBeDefined()
    const outsideRegion = municipalityCatalog.find(
      (entry) => entry.region !== catalogEntry!.region,
    )!

    const bundle = await loadMunicipalityListPageBundle(payload, coordinator, {
      region: catalogEntry!.region,
    })

    // The território filter narrows the Município options…
    expect(bundle.filterFacets.slugs).toContain(municipality.slug)
    expect(bundle.filterFacets.slugs).not.toContain(outsideRegion.slug)
    expect(bundle.filterFacets.slugs.length).toBeLessThan(municipalityCatalog.length)
    // …but not its own: the OR set must stay addable.
    expect(bundle.filterFacets.regions.length).toBeGreaterThan(1)

    // A selected value stays listed even when other filters exclude it, so it
    // can be undone from the popover.
    const conflicting = await loadMunicipalityListPageBundle(payload, coordinator, {
      region: catalogEntry!.region,
      slug: outsideRegion.slug,
    })
    expect(conflicting.municipalities).toHaveLength(0)
    expect(conflicting.filterFacets.slugs).toContain(outsideRegion.slug)
  })

  it('keeps the options of filters that share a popover with the applied one', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const advisor = await fixtures.createCampaignUser('advisor')
    const priorityMunicipality = await fixtures.getMunicipality()
    await payload.update({
      collection: 'municipality',
      id: priorityMunicipality.id,
      data: { priority: 'alta' },
      overrideAccess: true,
    })
    const covered = await fixtures.getMunicipality(
      municipalityCatalog.find((entry) => entry.slug !== priorityMunicipality.slug)!.slug,
    )
    await fixtures.assignMunicipalityAdvisors(covered.id, [advisor.id])

    // "Prioritária" lives in the Município popover, so it must not hide the
    // municipalities that popover is there to offer.
    const byPriority = await loadMunicipalityListPageBundle(payload, coordinator, {
      priority: 'alta',
    })
    expect(byPriority.municipalities.every((row) => row.priority === 'alta')).toBe(true)
    expect(byPriority.filterFacets.slugs).toContain(covered.slug)

    // Same for the "Sem assessor" toggle inside the Assessores popover: it would
    // otherwise leave that popover with nobody to pick.
    const withoutAdvisor = await loadMunicipalityListPageBundle(payload, coordinator, {
      coverage: 'sem_assessor',
    })
    expect(withoutAdvisor.filterFacets.advisorIDs).toContain(advisor.id)
  })

  it('returns an empty bundle for leaders (municipality list lockdown)', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const leader = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leader.id,
      supportStatus: 'engajado',
    })

    const bundle = await loadMunicipalityListPageBundle(payload, leader, { q: municipality.name })

    expect(bundle.overview).toBeNull()
    expect(bundle.municipalities).toHaveLength(0)
    expect(bundle.scopeTotal).toBe(0)
  })
})
