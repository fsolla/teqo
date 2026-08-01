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
        page: '2',
      }),
    ).toEqual({
      page: 2,
      q: 'irecê',
      regions: ['Velho Chico', 'Irecê'],
      coverage: 'sem_assessor',
      sort: 'votes2022',
      dir: 'asc',
    })
  })

  it('omits the default sort pair and page 1 from the canonical query', () => {
    const state = parseTerritoryListParams({ sort: 'pct', dir: 'desc', page: '1' })

    expect(serializeTerritoryListSearchParams(state).toString()).toBe('')
    expect(resolveTerritoryListSort(state)).toEqual({ sort: 'pct', dir: 'desc' })
  })

  it('serializes page > 1', () => {
    const state = parseTerritoryListParams({ page: '2' })
    expect(serializeTerritoryListSearchParams(state).toString()).toBe('page=2')
    expect(buildTerritoryListHref(state, 2)).toBe('/campanha/territorios?page=2')
  })

  it('preserves filters while toggling sort direction and resets to page 1', () => {
    const state = parseTerritoryListParams({ q: 'chico', region: 'Velho Chico', page: '2' })

    expect(buildTerritorySortHref(state, 'votes2022')).toBe(
      '/campanha/territorios?q=chico&region=Velho+Chico&sort=votes2022',
    )
    expect(
      buildTerritorySortHref(
        parseTerritoryListParams({
          q: 'chico',
          region: 'Velho Chico',
          sort: 'votes2022',
          dir: 'desc',
          page: '2',
        }),
        'votes2022',
      ),
    ).toContain('dir=asc')
    expect(buildTerritorySortHref(state, 'votes2022')).not.toContain('page=')
  })

  it('redirects unsupported and non-canonical query strings', () => {
    expect(resolveTerritoryListUrl({ q: '  Irecê  ', unknown: 'x' })).toEqual({
      state: { page: 1, q: 'Irecê' },
      href: '/campanha/territorios?q=Irec%C3%AA',
      redirectHref: '/campanha/territorios?q=Irec%C3%AA',
    })
  })

  it('clamps page above totalPages via redirect', () => {
    expect(resolveTerritoryListUrl({ page: '9' }, 2)).toEqual({
      state: { page: 2 },
      href: '/campanha/territorios?page=2',
      redirectHref: '/campanha/territorios?page=2',
    })
  })

  it('clears invalid values instead of serializing them', () => {
    const state = parseTerritoryListParams({
      coverage: 'talvez',
      sort: 'unknown',
      dir: 'sideways',
    })

    expect(state).toEqual({ page: 1 })
    expect(buildTerritoryListHref(state, 1)).toBe('/campanha/territorios')
  })
})

describe('territory list filter state', () => {
  it('toggles region and coverage filters canonically and resets page', () => {
    const withRegion = toggleTerritoryRegionFilter({ page: 2 }, 'Irecê')
    expect(withRegion).toEqual({ page: 1, regions: ['Irecê'] })
    expect(toggleTerritoryRegionFilter(withRegion, 'Irecê')).toEqual({ page: 1 })

    const withCoverage = toggleTerritoryCoverageFilter({ page: 2 }, 'sem_assessor')
    expect(withCoverage).toEqual({ page: 1, coverage: 'sem_assessor' })
    expect(toggleTerritoryCoverageFilter(withCoverage, 'sem_assessor')).toEqual({ page: 1 })
  })

  it('clears filters while preserving the selected sort', () => {
    expect(
      clearTerritoryListFilters({
        page: 3,
        q: 'irecê',
        regions: ['Irecê'],
        coverage: 'sem_assessor',
        sort: 'votes2022',
        dir: 'asc',
      }),
    ).toEqual({ page: 1, sort: 'votes2022', dir: 'asc' })
  })

  it('formats a compact active-filter summary', () => {
    expect(
      formatTerritoryActiveFiltersSummary({
        page: 1,
        q: 'chico',
        regions: ['Irecê', 'Velho Chico'],
        coverage: 'sem_assessor',
      }),
    ).toBe('Irecê, Velho Chico · Com lacunas de assessoria · Busca "chico"')
  })
})
