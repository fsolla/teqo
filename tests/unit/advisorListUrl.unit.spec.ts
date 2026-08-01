import { describe, expect, it } from 'vitest'

import {
  advisorListHrefForPage,
  parseAdvisorListParams,
  resolveAdvisorListUrl,
  serializeCanonicalAdvisorListSearchParams,
} from '@/utilities/advisor/advisorListUrl'

describe('advisor list URL contract', () => {
  it('defaults to page 1 without q', () => {
    expect(parseAdvisorListParams({})).toEqual({ page: 1 })
  })

  it('validates page as a positive decimal integer', () => {
    expect(parseAdvisorListParams({ page: '4' }).page).toBe(4)
    expect(parseAdvisorListParams({ page: '0' }).page).toBe(1)
    expect(parseAdvisorListParams({ page: '-2' }).page).toBe(1)
    expect(parseAdvisorListParams({ page: '01' }).page).toBe(1)
    expect(parseAdvisorListParams({ page: 'abc' }).page).toBe(1)
  })

  it('trims q, omits it when empty and takes the first repeated cell', () => {
    expect(parseAdvisorListParams({ q: '  ana  ' }).q).toBe('ana')
    expect(parseAdvisorListParams({ q: '   ' }).q).toBeUndefined()
    expect(parseAdvisorListParams({ q: ['primeiro', 'segundo'] }).q).toBe('primeiro')
  })

  it('preserves criar=1 as autoCreateDraft through parse and serialize', () => {
    const state = parseAdvisorListParams({ criar: '1', q: 'edi' })
    expect(state).toEqual({ page: 1, q: 'edi', autoCreateDraft: true })
    expect(serializeCanonicalAdvisorListSearchParams(state).toString()).toBe('q=edi&criar=1')
  })

  it('drops criar when it is not the quick-create sentinel', () => {
    expect(parseAdvisorListParams({ criar: '0' })).toEqual({ page: 1 })
    expect(parseAdvisorListParams({ criar: 'yes' })).toEqual({ page: 1 })
  })

  it('serializes q then page against the assessores base path', () => {
    expect(advisorListHrefForPage({ page: 1 }, 1)).toBe('/campanha/assessores')
    expect(advisorListHrefForPage({ page: 1, q: 'edi' }, 3)).toBe(
      '/campanha/assessores?q=edi&page=3',
    )
  })

  it('pagination hrefs drop the one-shot criar flag', () => {
    expect(advisorListHrefForPage({ page: 1, q: 'edi', autoCreateDraft: true }, 2)).toBe(
      '/campanha/assessores?q=edi&page=2',
    )
  })

  it('redirects junk params to the canonical form', () => {
    expect(resolveAdvisorListUrl({ foo: 'bar', q: ' ana ', page: '01' })).toEqual({
      state: { page: 1, q: 'ana' },
      href: '/campanha/assessores?q=ana',
      redirectHref: '/campanha/assessores?q=ana',
    })
  })

  it('preserves criar=1 across canonical redirect of junk params', () => {
    expect(resolveAdvisorListUrl({ criar: '1', junk: 'x' })).toEqual({
      state: { page: 1, autoCreateDraft: true },
      href: '/campanha/assessores?criar=1',
      redirectHref: '/campanha/assessores?criar=1',
    })
  })

  it('clamps page above totalPages', () => {
    expect(resolveAdvisorListUrl({ page: '9' }, 2)).toEqual({
      state: { page: 2 },
      href: '/campanha/assessores?page=2',
      redirectHref: '/campanha/assessores?page=2',
    })
  })

  it('is a no-op redirect when already canonical', () => {
    expect(resolveAdvisorListUrl({ q: 'ana', page: '2' })).toEqual({
      state: { page: 2, q: 'ana' },
      href: '/campanha/assessores?q=ana&page=2',
    })
  })
})
