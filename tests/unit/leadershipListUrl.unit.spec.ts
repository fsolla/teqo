import { describe, expect, it } from 'vitest'

import {
  clearLeadershipAccessFilter,
  clearLeadershipListFilters,
  clearLeadershipMunicipalityFilter,
  clearLeadershipOrganizationFilter,
  clearLeadershipStateDeputyFilter,
  clearLeadershipStatusFilter,
  formatLeadershipActiveFiltersSummary,
  toggleLeadershipAccessFilter,
  toggleLeadershipMunicipalityFilter,
  toggleLeadershipOrganizationFilter,
  toggleLeadershipStateDeputyFilter,
  toggleLeadershipStatusFilter,
} from '@/utilities/leadership/leadershipListFilters'
import {
  buildLeadershipListHref,
  buildLeadershipSortHref,
  parseLeadershipListParams,
  resolveLeadershipListPayloadSort,
  resolveLeadershipListSort,
  resolveLeadershipListUrl,
  serializeCanonicalLeadershipListSearchParams,
} from '@/utilities/leadership/leadershipListUrl'

describe('leadership list URL contract', () => {
  it('defaults to page 1 with no sort/filters', () => {
    expect(parseLeadershipListParams({})).toEqual({ page: 1 })
  })

  it('B161 — page left the URL contract: any page token drops to 1', () => {
    expect(parseLeadershipListParams({ page: '4' }).page).toBe(1)
    expect(parseLeadershipListParams({ page: '0' }).page).toBe(1)
    expect(parseLeadershipListParams({ page: 'abc' }).page).toBe(1)
  })

  it('trims q, omits it when empty and takes the first repeated cell', () => {
    expect(parseLeadershipListParams({ q: '  ana  ' }).q).toBe('ana')
    expect(parseLeadershipListParams({ q: '   ' }).q).toBeUndefined()
    expect(parseLeadershipListParams({ q: ['primeiro', 'segundo'] }).q).toBe('primeiro')
  })

  it('parses and dedupes known status values and integer municipality ids', () => {
    expect(
      parseLeadershipListParams({
        status: ['engajado', 'a_abordar', 'engajado', 'unknown'],
        sector: ['religioso'],
        municipality: ['12', '12', '0', 'abc', '3'],
        organization: ['5', '5', '0', 'abc', '8'],
        stateDeputy: ['21', '21', '0', 'abc', '34'],
      }),
    ).toEqual({
      page: 1,
      statuses: ['engajado', 'a_abordar'],
      municipalities: [12, 3],
      organizations: [5, 8],
      stateDeputies: [21, 34],
    })
  })

  it('canonicalizes selecting every status member to the absent filter (B18)', () => {
    expect(
      parseLeadershipListParams({
        status: ['engajado', 'a_abordar', 'em_disputa', 'negativo'],
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
      organization: ['5', '8'],
      stateDeputy: ['21'],
      access: 'sem',
      sort: 'name',
      dir: 'asc',
    })
    expect(buildLeadershipListHref(state)).toBe(
      '/campanha/liderancas?q=ana&status=a_abordar&municipality=7&organization=5&organization=8&stateDeputy=21&access=sem&sort=name',
    )
  })

  it('drops the legacy sector param from the canonical query', () => {
    expect(resolveLeadershipListUrl({ sector: 'religioso' })).toEqual({
      state: { page: 1 },
      href: '/campanha/liderancas',
      redirectHref: '/campanha/liderancas',
    })
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

  it('B161 — drops stale page params and redirects non-canonical query strings', () => {
    expect(resolveLeadershipListUrl({ page: '9' })).toEqual({
      state: { page: 1 },
      href: '/campanha/liderancas',
      redirectHref: '/campanha/liderancas',
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

  it('toggles organization and stateDeputy filters and resets the page', () => {
    const withOrganization = toggleLeadershipOrganizationFilter({ page: 2 }, '15')
    expect(withOrganization).toEqual({ page: 1, organizations: [15] })
    expect(toggleLeadershipOrganizationFilter(withOrganization, '15')).toEqual({ page: 1 })

    const withStateDeputy = toggleLeadershipStateDeputyFilter({ page: 2 }, '9')
    expect(withStateDeputy).toEqual({ page: 1, stateDeputies: [9] })
    expect(toggleLeadershipStateDeputyFilter(withStateDeputy, '9')).toEqual({ page: 1 })
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
    expect(
      clearLeadershipOrganizationFilter({
        page: 1,
        organizations: [5],
        q: 'ana',
      }),
    ).toEqual({ page: 1, q: 'ana' })
    expect(
      clearLeadershipStateDeputyFilter({
        page: 1,
        stateDeputies: [3],
        sort: 'name',
        dir: 'asc',
      }),
    ).toEqual({ page: 1, sort: 'name', dir: 'asc' })
  })

  it('clears every filter and the search, keeping sort', () => {
    expect(
      clearLeadershipListFilters({
        page: 4,
        q: 'ana',
        statuses: ['engajado'],
        sort: 'supportStatus',
        dir: 'asc',
      }),
    ).toEqual({ page: 1, sort: 'supportStatus', dir: 'asc' })
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
