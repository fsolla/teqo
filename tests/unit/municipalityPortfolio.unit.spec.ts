import { describe, expect, it } from 'vitest'

import { citiesForTerritory } from '@/lib/bahiaTerritories'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  buildMunicipalityPortfolioChips,
  catalogEntriesForTseZone,
  expandMunicipalityPortfolioChips,
  searchMunicipalityPortfolio,
  type MunicipalityPortfolioIndexEntry,
} from '@/lib/municipalityPortfolio'

const buildIndex = (): MunicipalityPortfolioIndexEntry[] =>
  municipalityCatalog.map((entry, index) => ({ id: index + 1, slug: entry.slug }))

const catalogNameForSlug = (slug: string): string =>
  municipalityCatalog.find((entry) => entry.slug === slug)?.name ?? ''

/** The index is keyed by slug; `city` lives only in the catalog it is built from. */
const slugsForCities = (cities: readonly string[]): Set<string> =>
  new Set(municipalityCatalog.filter((entry) => cities.includes(entry.city)).map((e) => e.slug))

describe('municipalityPortfolio', () => {
  it('collapses a full identity territory into a single chip', () => {
    const index = buildIndex()
    const irece = slugsForCities(citiesForTerritory('Irecê'))
    const assignedIds = index.filter((entry) => irece.has(entry.slug)).map((entry) => entry.id)

    const chips = buildMunicipalityPortfolioChips(assignedIds, index)
    expect(chips).toHaveLength(1)
    expect(chips[0]).toMatchObject({ kind: 'territory', label: 'Irecê' })
  })

  it('keeps partial territory membership as municipality chips', () => {
    const index = buildIndex()
    const ireceSlugs = slugsForCities(['Irecê'])
    const one = index.find((entry) => ireceSlugs.has(entry.slug))
    expect(one).toBeTruthy()
    const chips = buildMunicipalityPortfolioChips([one!.id], index)
    expect(chips).toEqual([
      {
        kind: 'municipality',
        key: `municipality:${one!.id}`,
        label: catalogNameForSlug(one!.slug),
        municipalityId: one!.id,
        slug: one!.slug,
      },
    ])
  })

  it('collapses the complete Salvador zone set into one "Salvador (N)" chip', () => {
    const index = buildIndex()
    const salvadorZones = slugsForCities(['Salvador'])
    const assignedIds = index
      .filter((entry) => salvadorZones.has(entry.slug))
      .map((entry) => entry.id)

    const chips = buildMunicipalityPortfolioChips(assignedIds, index)
    expect(chips).toHaveLength(1)
    expect(chips[0]).toMatchObject({ kind: 'city', label: 'Salvador' })
    expect(chips[0]?.kind === 'city' ? chips[0].municipalityIds.length : 0).toBe(19)
  })

  it('keeps a partial Salvador zone set as municipality chips (never the city chip)', () => {
    const index = buildIndex()
    const salvadorZones = slugsForCities(['Salvador'])
    const one = index.find((entry) => salvadorZones.has(entry.slug))
    expect(one).toBeTruthy()
    const chips = buildMunicipalityPortfolioChips([one!.id], index)
    expect(chips).toHaveLength(1)
    expect(chips[0]).toMatchObject({ kind: 'municipality', municipalityId: one!.id })
  })

  it('expands a collapsed territory chip into its member municipality chips', () => {
    const index = buildIndex()
    const irece = slugsForCities(citiesForTerritory('Irecê'))
    const assignedIds = index.filter((entry) => irece.has(entry.slug)).map((entry) => entry.id)
    const collapsed = buildMunicipalityPortfolioChips(assignedIds, index)
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.kind).toBe('territory')

    const expanded = expandMunicipalityPortfolioChips(
      collapsed,
      new Set(['territory:Irecê']),
      index,
    )
    expect(expanded).toHaveLength(assignedIds.length)
    const municipalityChips = expanded.filter((chip) => chip.kind === 'municipality')
    expect(municipalityChips).toHaveLength(expanded.length)
    expect(new Set(municipalityChips.map((chip) => chip.municipalityId))).toEqual(
      new Set(assignedIds),
    )
  })

  it('expands the Salvador city chip into its 19 zone municipality chips', () => {
    const index = buildIndex()
    const salvadorZones = slugsForCities(['Salvador'])
    const assignedIds = index
      .filter((entry) => salvadorZones.has(entry.slug))
      .map((entry) => entry.id)
    const collapsed = buildMunicipalityPortfolioChips(assignedIds, index)

    const expanded = expandMunicipalityPortfolioChips(collapsed, new Set(['city:Salvador']), index)
    expect(expanded).toHaveLength(19)
    expect(expanded.every((chip) => chip.kind === 'municipality')).toBe(true)
  })

  it('leaves non-expanded chips untouched', () => {
    const index = buildIndex()
    const irece = slugsForCities(citiesForTerritory('Irecê'))
    const assignedIds = index.filter((entry) => irece.has(entry.slug)).map((entry) => entry.id)
    const collapsed = buildMunicipalityPortfolioChips(assignedIds, index)

    const unchanged = expandMunicipalityPortfolioChips(collapsed, new Set(['city:Salvador']), index)
    expect(unchanged).toEqual(collapsed)
  })

  it('drops an id the index does not know (no name, no link to render)', () => {
    const index = buildIndex()
    expect(buildMunicipalityPortfolioChips([999_999], index)).toEqual([])
  })

  it('resolves Salvador ZE to the zone municipality entry only', () => {
    const entries = catalogEntriesForTseZone(3)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.slug).toBe('salvador-ze-3')
  })

  it('searches municipalities, territories and zones', () => {
    const index = buildIndex()
    const municipalityHits = searchMunicipalityPortfolio('Feira', index, new Set())
    expect(municipalityHits.some((hit) => hit.kind === 'municipality')).toBe(true)

    const territoryHits = searchMunicipalityPortfolio('Irecê', index, new Set())
    expect(territoryHits.some((hit) => hit.kind === 'territory' && hit.label === 'Irecê')).toBe(
      true,
    )

    const zoneHits = searchMunicipalityPortfolio('ZE 3', index, new Set())
    expect(zoneHits.some((hit) => hit.kind === 'zone' && hit.zoneNumber === 3)).toBe(true)
  })

  it('offers Salvador as one aggregate hit with all 19 zones, first in the list', () => {
    const index = buildIndex()
    const hits = searchMunicipalityPortfolio('salvador', index, new Set())

    expect(hits[0]).toMatchObject({ kind: 'city', key: 'city:Salvador', label: 'Salvador' })
    expect(hits[0]?.kind === 'city' ? hits[0].municipalityIds : []).toHaveLength(19)
  })

  it('the Salvador aggregate omits already-assigned zones', () => {
    const index = buildIndex()
    const salvadorSlugs = slugsForCities(['Salvador'])
    const salvadorIds = index
      .filter((entry) => salvadorSlugs.has(entry.slug))
      .map((entry) => entry.id)
    const assigned = new Set(salvadorIds.slice(0, 5))

    const hits = searchMunicipalityPortfolio('salvador', index, assigned)
    expect(hits[0]?.kind).toBe('city')
    expect(hits[0]?.kind === 'city' ? hits[0].municipalityIds : []).toHaveLength(14)
  })

  it('suppresses the aggregate when the whole city is not in the addable scope', () => {
    const index = buildIndex()
    const salvadorSlugs = slugsForCities(['Salvador'])
    const threeZones = index.filter((entry) => salvadorSlugs.has(entry.slug)).slice(0, 3)
    expect(threeZones).toHaveLength(3)

    const hits = searchMunicipalityPortfolio('salvador', threeZones, new Set())
    expect(hits.some((hit) => hit.kind === 'city')).toBe(false)
    expect(hits.filter((hit) => hit.kind === 'municipality')).toHaveLength(3)
  })

  it('offers no aggregate when every zone is already assigned (the chip takes over)', () => {
    const index = buildIndex()
    const salvadorSlugs = slugsForCities(['Salvador'])
    const salvadorIds = index
      .filter((entry) => salvadorSlugs.has(entry.slug))
      .map((entry) => entry.id)

    const hits = searchMunicipalityPortfolio('salvador', index, new Set(salvadorIds))
    expect(hits.some((hit) => hit.kind === 'city')).toBe(false)
  })
})
