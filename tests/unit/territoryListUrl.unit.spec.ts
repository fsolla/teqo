import { describe, expect, it } from 'vitest'

import {
  clearTerritoryListFilters,
  formatTerritoryActiveFiltersSummary,
  toggleTerritoryCoverageFilter,
  toggleTerritoryRegionFilter,
} from '@/utilities/territory/territoryListFilters'
import {
  buildTerritoryListHref,
  buildTerritorySortHref,
  parseTerritoryListParams,
  resolveTerritoryListSort,
  resolveTerritoryListUrl,
  serializeTerritoryListSearchParams,
} from '@/utilities/territory/territoryListUrl'

describe('territory list URL contract', () => {
  it('parses and canonicalizes supported filters', () => {
    expect(
      parseTerritoryListParams({
        q: '  irecê ',
        region: ['Velho Chico', 'Irecê', 'Velho Chico', 'desconhecido'],
        coverage: 'sem_assessor',
        sort: 'votes2022',
        dir: 'asc',
      }),
    ).toEqual({
      q: 'irecê',
      regions: ['Velho Chico', 'Irecê'],
      coverage: 'sem_assessor',
      sort: 'votes2022',
      dir: 'asc',
    })
  })

  it('omits the default sort pair from the canonical query', () => {
    const state = parseTerritoryListParams({ sort: 'pct', dir: 'desc' })

    expect(serializeTerritoryListSearchParams(state).toString()).toBe('')
    expect(resolveTerritoryListSort(state)).toEqual({ sort: 'pct', dir: 'desc' })
  })

  it('preserves filters while toggling sort direction', () => {
    const state = parseTerritoryListParams({ q: 'chico', region: 'Velho Chico' })

    expect(buildTerritorySortHref(state, 'votes2022')).toBe(
      '/campanha/territorios?q=chico&region=Velho+Chico&sort=votes2022',
    )
    expect(
      buildTerritorySortHref(
        parseTerritoryListParams({ ...state, sort: 'votes2022', dir: 'desc' }),
        'votes2022',
      ),
    ).toContain('dir=asc')
  })

  it('redirects unsupported and non-canonical query strings', () => {
    expect(resolveTerritoryListUrl({ q: '  Irecê  ', unknown: 'x' })).toEqual({
      state: { q: 'Irecê' },
      href: '/campanha/territorios?q=Irec%C3%AA',
      redirectHref: '/campanha/territorios?q=Irec%C3%AA',
    })
  })

  it('clears invalid values instead of serializing them', () => {
    const state = parseTerritoryListParams({
      coverage: 'talvez',
      sort: 'unknown',
      dir: 'sideways',
    })

    expect(state).toEqual({})
    expect(buildTerritoryListHref(state)).toBe('/campanha/territorios')
  })
})

describe('territory list filter state', () => {
  it('toggles region and coverage filters canonically', () => {
    const withRegion = toggleTerritoryRegionFilter({}, 'Irecê')
    expect(withRegion).toEqual({ regions: ['Irecê'] })
    expect(toggleTerritoryRegionFilter(withRegion, 'Irecê')).toEqual({})

    const withCoverage = toggleTerritoryCoverageFilter({}, 'sem_assessor')
    expect(withCoverage).toEqual({ coverage: 'sem_assessor' })
    expect(toggleTerritoryCoverageFilter(withCoverage, 'sem_assessor')).toEqual({})
  })

  it('clears filters while preserving the selected sort', () => {
    expect(
      clearTerritoryListFilters({
        q: 'irecê',
        regions: ['Irecê'],
        coverage: 'sem_assessor',
        sort: 'votes2022',
        dir: 'asc',
      }),
    ).toEqual({ sort: 'votes2022', dir: 'asc' })
  })

  it('formats a compact active-filter summary', () => {
    expect(
      formatTerritoryActiveFiltersSummary({
        q: 'chico',
        regions: ['Irecê', 'Velho Chico'],
        coverage: 'sem_assessor',
      }),
    ).toBe('Irecê, Velho Chico · Com lacunas de assessoria · Busca "chico"')
  })
})
