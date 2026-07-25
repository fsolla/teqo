import { describe, expect, it } from 'vitest'

import {
  allParamValues,
  buildListHref,
  firstValue,
  inspectRawListParams,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

describe('firstValue', () => {
  it('returns the first cell of a repeated param and passes scalars through', () => {
    expect(firstValue(['a', 'b'])).toBe('a')
    expect(firstValue('x')).toBe('x')
    expect(firstValue(undefined)).toBeUndefined()
  })
})

describe('allParamValues', () => {
  it('flattens, trims, dedupes and drops empty cells', () => {
    expect(allParamValues([' a ', 'b', 'a', ''])).toEqual(['a', 'b'])
    expect(allParamValues('solo')).toEqual(['solo'])
    expect(allParamValues(undefined)).toEqual([])
    expect(allParamValues(['   '])).toEqual([])
  })
})

describe('normalizedText', () => {
  it('trims and turns empty/non-string into undefined', () => {
    expect(normalizedText('  salvador  ')).toBe('salvador')
    expect(normalizedText('')).toBeUndefined()
    expect(normalizedText('   ')).toBeUndefined()
    expect(normalizedText(undefined)).toBeUndefined()
  })
})

describe('strictDecimalInteger', () => {
  it('accepts only positive decimal integers without leading zeros', () => {
    expect(strictDecimalInteger('12')).toBe(12)
    expect(strictDecimalInteger('1')).toBe(1)
    expect(strictDecimalInteger('0')).toBeUndefined()
    expect(strictDecimalInteger('01')).toBeUndefined()
    expect(strictDecimalInteger('-3')).toBeUndefined()
    expect(strictDecimalInteger('1.5')).toBeUndefined()
    expect(strictDecimalInteger('abc')).toBeUndefined()
    expect(strictDecimalInteger(undefined)).toBeUndefined()
  })

  it('rejects unsafe integers', () => {
    expect(strictDecimalInteger('9007199254740993')).toBeUndefined()
  })
})

describe('inspectRawListParams', () => {
  const paramNameSet = new Set(['q', 'page'])

  it('flags unsupported params and excludes them from the serialized query', () => {
    const result = inspectRawListParams({ q: 'x', foo: '1' }, paramNameSet)
    expect(result.hasUnsupportedParams).toBe(true)
    expect(result.query).toBe('q=x')
  })

  it('serializes repeated values in order and skips undefined', () => {
    const result = inspectRawListParams({ q: ['a', 'b'], page: undefined }, paramNameSet)
    expect(result.hasUnsupportedParams).toBe(false)
    expect(result.query).toBe('q=a&q=b')
  })
})

// A minimal list-state fixture mirroring how supporter/activity lists wire
// resolveListUrl: q + page, canonical order q-then-page, page omitted at 1.
type FixtureState = { page: number; q?: string }

const fixtureParamNameSet = new Set(['q', 'page'])

const parseFixture = (params: RawSearchParams): FixtureState => {
  const q = normalizedText(firstValue(params.q))
  return {
    page: strictDecimalInteger(firstValue(params.page)) ?? 1,
    ...(q ? { q } : {}),
  }
}

const buildFixtureSearchParams = (state: FixtureState, page = state.page): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (page > 1) params.set('page', String(page))
  return params
}

const resolveFixtureUrl = (params: RawSearchParams, totalPages?: number) =>
  resolveListUrl({
    params,
    paramNameSet: fixtureParamNameSet,
    parse: parseFixture,
    buildSearchParams: buildFixtureSearchParams,
    basePath: '/campanha/lista',
    totalPages,
  })

describe('resolveListUrl', () => {
  it('passes a canonical URL through without a redirect', () => {
    const result = resolveFixtureUrl({ q: 'x', page: '2' })
    expect(result.state).toEqual({ page: 2, q: 'x' })
    expect(result.href).toBe('/campanha/lista?q=x&page=2')
    expect(result.redirectHref).toBeUndefined()
  })

  it('redirects when raw params are in non-canonical order', () => {
    const result = resolveFixtureUrl({ page: '2', q: 'x' })
    expect(result.redirectHref).toBe('/campanha/lista?q=x&page=2')
  })

  it('redirects on unsupported params, dropping them', () => {
    const result = resolveFixtureUrl({ q: 'x', foo: '1' })
    expect(result.state).toEqual({ page: 1, q: 'x' })
    expect(result.redirectHref).toBe('/campanha/lista?q=x')
  })

  it('clamps page to totalPages and redirects', () => {
    const result = resolveFixtureUrl({ page: '9' }, 3)
    expect(result.state.page).toBe(3)
    expect(result.redirectHref).toBe('/campanha/lista?page=3')
  })

  it('does not clamp when totalPages is 0 (empty result set)', () => {
    const result = resolveFixtureUrl({ page: '9' }, 0)
    expect(result.state.page).toBe(9)
    expect(result.redirectHref).toBeUndefined()
  })

  it('normalizes page=1 out of the URL', () => {
    const result = resolveFixtureUrl({ page: '1' })
    expect(result.href).toBe('/campanha/lista')
    expect(result.redirectHref).toBe('/campanha/lista')
  })
})

describe('buildListHref', () => {
  it('omits the query entirely when the builder emits no params', () => {
    expect(buildListHref({ page: 1 }, buildFixtureSearchParams, '/campanha/lista', 1)).toBe(
      '/campanha/lista',
    )
    expect(buildListHref({ page: 1 }, buildFixtureSearchParams, '/campanha/lista', 4)).toBe(
      '/campanha/lista?page=4',
    )
  })
})
