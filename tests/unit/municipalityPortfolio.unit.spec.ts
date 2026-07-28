import { describe, expect, it } from 'vitest'

import { citiesForTerritory } from '@/lib/bahiaTerritories'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  buildMunicipalityPortfolioChips,
  catalogEntriesForTseZone,
  searchMunicipalityPortfolio,
  type MunicipalityPortfolioIndexEntry,
} from '@/lib/municipalityPortfolio'

const buildIndex = (): MunicipalityPortfolioIndexEntry[] =>
  municipalityCatalog.map((entry, index) => ({
    id: index + 1,
    name: entry.name,
    slug: entry.slug,
    region: entry.region,
  }))

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
        label: one!.name,
        municipalityId: one!.id,
        slug: one!.slug,
      },
    ])
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
})
