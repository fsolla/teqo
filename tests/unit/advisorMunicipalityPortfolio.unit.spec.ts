import { describe, expect, it } from 'vitest'

import {
  buildAdvisorPortfolioChips,
  catalogEntriesForTseZone,
  searchAdvisorPortfolio,
  type AdvisorMunicipalityIndexEntry,
} from '@/lib/advisorMunicipalityPortfolio'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import { citiesForTerritory } from '@/lib/bahiaTerritories'

const buildIndex = (): AdvisorMunicipalityIndexEntry[] =>
  municipalityCatalog.map((entry, index) => ({
    id: index + 1,
    name: entry.name,
    slug: entry.slug,
    region: entry.region,
    city: entry.city,
    zoneNumber: entry.zoneNumber ?? null,
  }))

describe('advisorMunicipalityPortfolio', () => {
  it('collapses a full identity territory into a single chip', () => {
    const index = buildIndex()
    const irece = citiesForTerritory('Irecê')
    const assigned = index
      .filter((entry) => irece.includes(entry.city))
      .map((entry) => ({ id: entry.id, name: entry.name, slug: entry.slug }))

    const chips = buildAdvisorPortfolioChips(assigned, index)
    expect(chips).toHaveLength(1)
    expect(chips[0]).toMatchObject({ kind: 'territory', label: 'Irecê' })
  })

  it('keeps partial territory membership as municipality chips', () => {
    const index = buildIndex()
    const one = index.find((entry) => entry.city === 'Irecê')
    expect(one).toBeTruthy()
    const chips = buildAdvisorPortfolioChips(
      [{ id: one!.id, name: one!.name, slug: one!.slug }],
      index,
    )
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

  it('resolves Salvador ZE to the zone municipality entry only', () => {
    const entries = catalogEntriesForTseZone(3)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.slug).toBe('salvador-ze-3')
  })

  it('searches municipalities, territories and zones', () => {
    const index = buildIndex()
    const municipalityHits = searchAdvisorPortfolio('Feira', index, new Set())
    expect(municipalityHits.some((hit) => hit.kind === 'municipality')).toBe(true)

    const territoryHits = searchAdvisorPortfolio('Irecê', index, new Set())
    expect(territoryHits.some((hit) => hit.kind === 'territory' && hit.label === 'Irecê')).toBe(
      true,
    )

    const zoneHits = searchAdvisorPortfolio('ZE 3', index, new Set())
    expect(zoneHits.some((hit) => hit.kind === 'zone' && hit.zoneNumber === 3)).toBe(true)
  })
})
