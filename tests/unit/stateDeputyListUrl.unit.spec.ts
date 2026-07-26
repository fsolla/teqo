import { describe, expect, it } from 'vitest'

import {
  clearStateDeputyListFilters,
  clearStateDeputyPartyFilter,
  formatStateDeputyActiveFiltersSummary,
  toggleStateDeputyPartyFilter,
} from '@/utilities/stateDeputyListFilters'
import {
  buildStateDeputyListHref,
  buildStateDeputySortHref,
  NO_PARTY_FILTER_VALUE,
  parseStateDeputyListParams,
  parseStateDeputySortValue,
  resolveStateDeputyListPayloadSort,
  resolveStateDeputyListSort,
  resolveStateDeputyListUrl,
  serializeCanonicalStateDeputyListSearchParams,
  serializeStateDeputySortValue,
} from '@/utilities/stateDeputyListUrl'

describe('state deputy list URL contract', () => {
  it('defaults to page 1 with no sort/filters', () => {
    expect(parseStateDeputyListParams({})).toEqual({ page: 1 })
  })

  it('validates page as a positive decimal integer', () => {
    expect(parseStateDeputyListParams({ page: '4' }).page).toBe(4)
    expect(parseStateDeputyListParams({ page: '0' }).page).toBe(1)
    expect(parseStateDeputyListParams({ page: '-2' }).page).toBe(1)
    expect(parseStateDeputyListParams({ page: 'abc' }).page).toBe(1)
  })

  it('trims q, omits it when empty and takes the first repeated cell', () => {
    expect(parseStateDeputyListParams({ q: '  ana  ' }).q).toBe('ana')
    expect(parseStateDeputyListParams({ q: '   ' }).q).toBeUndefined()
    expect(parseStateDeputyListParams({ q: ['primeiro', 'segundo'] }).q).toBe('primeiro')
  })

  it('parses and dedupes repeated party params, ignoring overlong tokens', () => {
    expect(
      parseStateDeputyListParams({
        party: ['PT', 'PSD', 'PT', 'a'.repeat(33)],
      }).parties,
    ).toEqual(['PT', 'PSD'])
  })

  it('keeps only known sort keys and directions', () => {
    expect(parseStateDeputyListParams({ sort: 'party', dir: 'desc' })).toEqual({
      page: 1,
      sort: 'party',
      dir: 'desc',
    })
    expect(parseStateDeputyListParams({ sort: 'unknown', dir: 'sideways' })).toEqual({ page: 1 })
  })

  it('omits the default sort pair from the canonical query', () => {
    const state = parseStateDeputyListParams({ sort: 'name', dir: 'asc' })
    expect(serializeCanonicalStateDeputyListSearchParams(state).toString()).toBe('')
    expect(resolveStateDeputyListSort(state)).toEqual({ sort: 'name', dir: 'asc' })
  })

  it('serializes a non-default sort pair and repeated party filters', () => {
    const state = parseStateDeputyListParams({
      q: 'edu',
      party: ['PT', 'PSD'],
      sort: 'party',
      dir: 'desc',
    })
    expect(buildStateDeputyListHref(state, 1)).toBe(
      '/campanha/dobradinhas?q=edu&party=PT&party=PSD&sort=party&dir=desc',
    )
  })

  it('preserves filters while toggling sort direction and resets to page 1', () => {
    const state = parseStateDeputyListParams({ q: 'edu', page: '3' })

    expect(buildStateDeputySortHref(state, 'party')).toBe('/campanha/dobradinhas?q=edu&sort=party')
    expect(buildStateDeputySortHref({ ...state, sort: 'party' }, 'party')).toContain('dir=desc')
  })

  it('resolves the payload sort string with the descending prefix', () => {
    expect(resolveStateDeputyListPayloadSort('name', 'asc')).toBe('name')
    expect(resolveStateDeputyListPayloadSort('party', 'desc')).toBe('-party')
  })

  it('clamps an out-of-range page and redirects non-canonical query strings', () => {
    expect(resolveStateDeputyListUrl({ page: '9' }, 2)).toEqual({
      state: { page: 2 },
      href: '/campanha/dobradinhas?page=2',
      redirectHref: '/campanha/dobradinhas?page=2',
    })
    expect(resolveStateDeputyListUrl({ q: '  edu  ', unknown: 'x' })).toEqual({
      state: { page: 1, q: 'edu' },
      href: '/campanha/dobradinhas?q=edu',
      redirectHref: '/campanha/dobradinhas?q=edu',
    })
  })

  it('round-trips the mobile sort select value', () => {
    expect(serializeStateDeputySortValue('party', 'desc')).toBe('party|desc')
    expect(parseStateDeputySortValue('party|desc')).toEqual({ key: 'party', dir: 'desc' })
    expect(parseStateDeputySortValue('unknown|desc')).toBeNull()
    expect(parseStateDeputySortValue('party|sideways')).toBeNull()
  })
})

describe('state deputy list filter state', () => {
  it('toggles the party filter and resets the page', () => {
    const withParty = toggleStateDeputyPartyFilter({ page: 3 }, 'PT')
    expect(withParty).toEqual({ page: 1, parties: ['PT'] })
    expect(toggleStateDeputyPartyFilter(withParty, 'PT')).toEqual({ page: 1 })
    expect(toggleStateDeputyPartyFilter(withParty, NO_PARTY_FILTER_VALUE)).toEqual({
      page: 1,
      parties: ['PT', NO_PARTY_FILTER_VALUE],
    })
  })

  it('clears only the party filter, keeping q and sort', () => {
    expect(
      clearStateDeputyPartyFilter({
        page: 2,
        q: 'edu',
        parties: ['PT'],
        sort: 'party',
        dir: 'desc',
      }),
    ).toEqual({ page: 1, q: 'edu', sort: 'party', dir: 'desc' })
  })

  it('clears filters and search while preserving the selected sort', () => {
    expect(
      clearStateDeputyListFilters({
        page: 2,
        q: 'edu',
        parties: ['PT'],
        sort: 'party',
        dir: 'desc',
      }),
    ).toEqual({ page: 1, sort: 'party', dir: 'desc' })
  })

  it('formats a compact active-filter summary, translating the sentinel', () => {
    expect(
      formatStateDeputyActiveFiltersSummary({
        page: 1,
        q: 'edu',
        parties: ['PT', 'PSD', NO_PARTY_FILTER_VALUE],
      }),
    ).toBe('PT, PSD +1 · Busca "edu"')
  })
})
