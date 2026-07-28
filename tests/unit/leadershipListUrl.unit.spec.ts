import { describe, expect, it } from 'vitest'

import {
  clearLeadershipAccessFilter,
  clearLeadershipListFilters,
  clearLeadershipMunicipalityFilter,
  clearLeadershipStatusFilter,
  formatLeadershipActiveFiltersSummary,
  toggleLeadershipAccessFilter,
  toggleLeadershipMunicipalityFilter,
  toggleLeadershipStatusFilter,
} from '@/utilities/leadershipListFilters'
import {
  buildLeadershipListHref,
  buildLeadershipSortHref,
  parseLeadershipListParams,
  resolveLeadershipListPayloadSort,
  resolveLeadershipListSort,
  resolveLeadershipListUrl,
  serializeCanonicalLeadershipListSearchParams,
} from '@/utilities/leadershipListUrl'

describe('leadership list URL contract', () => {
  it('defaults to page 1 with no sort/filters', () => {
    expect(parseLeadershipListParams({})).toEqual({ page: 1 })
  })

  it('validates page as a positive decimal integer', () => {
    expect(parseLeadershipListParams({ page: '4' }).page).toBe(4)
    expect(parseLeadershipListParams({ page: '0' }).page).toBe(1)
    expect(parseLeadershipListParams({ page: '-2' }).page).toBe(1)
    expect(parseLeadershipListParams({ page: 'abc' }).page).toBe(1)
  })

  it('trims q, omits it when empty and takes the first repeated cell', () => {
    expect(parseLeadershipListParams({ q: '  ana  ' }).q).toBe('ana')
    expect(parseLeadershipListParams({ q: '   ' }).q).toBeUndefined()
    expect(parseLeadershipListParams({ q: ['primeiro', 'segundo'] }).q).toBe('primeiro')
  })

  it('parses and dedupes known status/sector values and integer municipality ids', () => {
    expect(
      parseLeadershipListParams({
        status: ['engajado', 'a_abordar', 'engajado', 'unknown'],
        sector: ['religioso', 'clube', 'sindical'],
        municipality: ['12', '12', '0', 'abc', '3'],
      }),
    ).toEqual({
      page: 1,
      statuses: ['engajado', 'a_abordar'],
      sectors: ['religioso', 'sindical'],
      municipalities: [12, 3],
    })
  })

  it('canonicalizes selecting every status/sector member to the absent filter (B18)', () => {
    expect(
      parseLeadershipListParams({
        status: ['engajado', 'a_abordar', 'em_disputa', 'negativo'],
        sector: [
          'religioso',
          'sindical',
          'comunitario',
          'rural',
          'empresarial',
          'juventude',
          'saude',
          'educacao',
          'cultura',
          'outro',
        ],
      }),
    ).toEqual({ page: 1 })
  })

  it('keeps only known access / sort / dir tokens', () => {
    expect(parseLeadershipListParams({ access: 'sem', sort: 'name', dir: 'asc' })).toEqual({
      page: 1,
      access: 'sem',
      sort: 'name',
      dir: 'asc',
    })
    expect(parseLeadershipListParams({ access: 'maybe', sort: 'phone', dir: 'sideways' })).toEqual({
      page: 1,
    })
  })

  it('omits the default sort pair (updatedAt+desc) from the canonical query', () => {
    const state = parseLeadershipListParams({ sort: 'updatedAt', dir: 'desc' })
    expect(serializeCanonicalLeadershipListSearchParams(state).toString()).toBe('')
    expect(resolveLeadershipListSort(state)).toEqual({ sort: 'updatedAt', dir: 'desc' })
  })

  it('serializes a non-default sort pair and repeated filters', () => {
    const state = parseLeadershipListParams({
      q: 'ana',
      status: ['a_abordar'],
      sector: ['religioso'],
      municipality: ['7'],
      access: 'sem',
      sort: 'name',
      dir: 'asc',
    })
    expect(buildLeadershipListHref(state, 1)).toBe(
      '/campanha/liderancas?q=ana&status=a_abordar&sector=religioso&municipality=7&access=sem&sort=name',
    )
  })

  it('preserves filters while toggling sort direction and resets to page 1', () => {
    const state = parseLeadershipListParams({ q: 'ana', page: '3' })

    expect(buildLeadershipSortHref(state, 'name')).toBe('/campanha/liderancas?q=ana&sort=name')
    expect(buildLeadershipSortHref({ ...state, sort: 'name', dir: 'asc' }, 'name')).toContain(
      'dir=desc',
    )
  })

  it('resolves the payload sort string with the contact.name join and descending prefix', () => {
    expect(resolveLeadershipListPayloadSort('name', 'asc')).toBe('contact.name')
    expect(resolveLeadershipListPayloadSort('name', 'desc')).toBe('-contact.name')
    expect(resolveLeadershipListPayloadSort('updatedAt', 'desc')).toBe('-updatedAt')
    expect(resolveLeadershipListPayloadSort('supportStatus', 'asc')).toBe('supportStatus')
  })

  it('clamps an out-of-range page and redirects non-canonical query strings', () => {
    expect(resolveLeadershipListUrl({ page: '9' }, 2)).toEqual({
      state: { page: 2 },
      href: '/campanha/liderancas?page=2',
      redirectHref: '/campanha/liderancas?page=2',
    })
    expect(resolveLeadershipListUrl({ q: '  ana  ', unknown: 'x' })).toEqual({
      state: { page: 1, q: 'ana' },
      href: '/campanha/liderancas?q=ana',
      redirectHref: '/campanha/liderancas?q=ana',
    })
  })
})

describe('leadership list filter state', () => {
  it('toggles status and municipality filters and resets the page', () => {
    const withStatus = toggleLeadershipStatusFilter({ page: 3 }, 'engajado')
    expect(withStatus).toEqual({ page: 1, statuses: ['engajado'] })
    expect(toggleLeadershipStatusFilter(withStatus, 'engajado')).toEqual({ page: 1 })

    const withMunicipality = toggleLeadershipMunicipalityFilter({ page: 2 }, '15')
    expect(withMunicipality).toEqual({ page: 1, municipalities: [15] })
    expect(toggleLeadershipMunicipalityFilter(withMunicipality, '15')).toEqual({ page: 1 })
  })

  it('rejects padded municipality ids that strictDecimalInteger would drop', () => {
    expect(toggleLeadershipMunicipalityFilter({ page: 1 }, '01')).toEqual({ page: 1 })
    expect(toggleLeadershipMunicipalityFilter({ page: 1 }, '1.5')).toEqual({ page: 1 })
  })

  it('toggles access exclusively and clears only that filter', () => {
    const withAccess = toggleLeadershipAccessFilter({ page: 1 }, 'sem')
    expect(withAccess).toEqual({ page: 1, access: 'sem' })
    expect(toggleLeadershipAccessFilter(withAccess, 'sem')).toEqual({ page: 1 })
    expect(toggleLeadershipAccessFilter(withAccess, 'com')).toEqual({ page: 1, access: 'com' })
    expect(clearLeadershipAccessFilter(withAccess)).toEqual({ page: 1 })
  })

  it('clears only one filter, keeping q and sort', () => {
    expect(
      clearLeadershipStatusFilter({
        page: 2,
        q: 'ana',
        statuses: ['engajado'],
        sort: 'name',
        dir: 'asc',
      }),
    ).toEqual({ page: 1, q: 'ana', sort: 'name', dir: 'asc' })
    expect(
      clearLeadershipMunicipalityFilter({
        page: 1,
        municipalities: [1, 2],
        access: 'sem',
      }),
    ).toEqual({ page: 1, access: 'sem' })
  })

  it('clears every filter and the search, keeping sort', () => {
    expect(
      clearLeadershipListFilters({
        page: 4,
        q: 'ana',
        statuses: ['engajado'],
        sort: 'sector',
        dir: 'asc',
      }),
    ).toEqual({ page: 1, sort: 'sector', dir: 'asc' })
  })

  it('summarizes active filters with municipality labels when provided', () => {
    expect(
      formatLeadershipActiveFiltersSummary(
        {
          page: 1,
          statuses: ['a_abordar'],
          access: 'sem',
          q: 'maria',
          municipalities: [9],
        },
        new Map([[9, 'Feira de Santana']]),
      ),
    ).toBe('A abordar · Feira de Santana · Sem acesso · Busca "maria"')
  })
})
