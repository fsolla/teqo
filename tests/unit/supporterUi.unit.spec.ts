import { describe, expect, it } from 'vitest'

import {
  buildSupporterFiltersKey,
  buildSupporterListHref,
  buildSupporterListSearchParams,
  canAccessSupporterArea,
  getSupporterScopeLabel,
  parseSupporterListParams,
  resolveSupporterListUrl,
} from '@/utilities/supporter/supporterUi'

describe('parseSupporterListParams', () => {
  it('defaults to page 1 with no filters', () => {
    expect(parseSupporterListParams({})).toEqual({ page: 1 })
  })

  it('validates page strictly (positive decimal integer)', () => {
    expect(parseSupporterListParams({ page: '3' }).page).toBe(3)
    expect(parseSupporterListParams({ page: '0' }).page).toBe(1)
    expect(parseSupporterListParams({ page: '02' }).page).toBe(1)
    expect(parseSupporterListParams({ page: 'x' }).page).toBe(1)
  })

  it('trims q and omits it when empty', () => {
    expect(parseSupporterListParams({ q: '  maria  ' }).q).toBe('maria')
    expect(parseSupporterListParams({ q: '   ' }).q).toBeUndefined()
  })

  it('keeps only known vote intentions', () => {
    expect(parseSupporterListParams({ voteIntention: 'certo' }).voteIntention).toBe('certo')
    expect(parseSupporterListParams({ voteIntention: 'talvez' }).voteIntention).toBeUndefined()
  })

  it('keeps only known sources', () => {
    expect(parseSupporterListParams({ source: 'import_csv' }).source).toBe('import_csv')
    expect(parseSupporterListParams({ source: 'lideranca' }).source).toBe('lideranca')
    expect(parseSupporterListParams({ source: 'spam' }).source).toBeUndefined()
  })

  it('canonicalizes city through the Bahia municipality resolver', () => {
    expect(parseSupporterListParams({ city: ' salvador ' }).city).toBe('Salvador')
    expect(parseSupporterListParams({ city: 'Gotham' }).city).toBeUndefined()
  })

  it('parses municipality as a strict positive integer', () => {
    expect(parseSupporterListParams({ municipality: '42' }).municipality).toBe(42)
    expect(parseSupporterListParams({ municipality: '-1' }).municipality).toBeUndefined()
  })

  it('takes the first cell of repeated params', () => {
    expect(parseSupporterListParams({ q: ['ana', 'bia'] }).q).toBe('ana')
  })
})

describe('buildSupporterListSearchParams', () => {
  it('serializes in canonical order and omits page 1', () => {
    const params = buildSupporterListSearchParams({
      page: 1,
      q: 'ana',
      voteIntention: 'certo',
      source: 'import_csv',
      city: 'Salvador',
      municipality: 7,
    })
    expect(params.toString()).toBe(
      'q=ana&voteIntention=certo&source=import_csv&city=Salvador&municipality=7',
    )
  })

  it('includes page only beyond 1 and supports the page override', () => {
    expect(buildSupporterListSearchParams({ page: 2 }).toString()).toBe('page=2')
    expect(buildSupporterListSearchParams({ page: 1 }, 5).toString()).toBe('page=5')
  })
})

describe('buildSupporterFiltersKey / buildSupporterListHref', () => {
  it('derives a stable filters key from the canonical serialization', () => {
    expect(buildSupporterFiltersKey({ page: 3, q: 'ana' })).toBe('q=ana&page=3')
  })

  it('builds hrefs against the supporters base path', () => {
    expect(buildSupporterListHref({ page: 1 }, 1)).toBe('/campanha/apoiadores')
    expect(buildSupporterListHref({ page: 1, q: 'ana' }, 2)).toBe(
      '/campanha/apoiadores?q=ana&page=2',
    )
  })
})

describe('resolveSupporterListUrl', () => {
  it('is canonical for a clean URL', () => {
    const result = resolveSupporterListUrl({ voteIntention: 'indeciso' })
    expect(result.state.voteIntention).toBe('indeciso')
    expect(result.href).toBe('/campanha/apoiadores?voteIntention=indeciso')
    expect(result.redirectHref).toBeUndefined()
  })

  it('redirects away from unsupported params and clamps the page', () => {
    const unsupported = resolveSupporterListUrl({ foo: 'bar' })
    expect(unsupported.redirectHref).toBe('/campanha/apoiadores')

    const clamped = resolveSupporterListUrl({ page: '99' }, 4)
    expect(clamped.state.page).toBe(4)
    expect(clamped.redirectHref).toBe('/campanha/apoiadores?page=4')
  })
})

describe('getSupporterScopeLabel', () => {
  it('pluralizes by count', () => {
    expect(getSupporterScopeLabel(1)).toMatch(/^1 apoiador /)
    expect(getSupporterScopeLabel(2)).toMatch(/^2 apoiadores /)
  })
})

describe('canAccessSupporterArea', () => {
  it('allows staff roles and blocks leaders', () => {
    expect(canAccessSupporterArea('coordinator')).toBe(true)
    expect(canAccessSupporterArea('advisor')).toBe(true)
    expect(canAccessSupporterArea('candidate')).toBe(true)
    expect(canAccessSupporterArea('leader')).toBe(false)
  })
})
