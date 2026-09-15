// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildSpeechCutFiltersKey,
  buildSpeechCutListHref,
  buildSpeechCutListWhere,
  parseSpeechCutListParams,
  resolveSpeechCutListUrl,
  serializeCanonicalSpeechCutListSearchParams,
} from '@/utilities/speech/speechCutListUrl'

describe('parseSpeechCutListParams', () => {
  it('keeps the trimmed query and the page', () => {
    expect(parseSpeechCutListParams({ q: '  Saúde  ', page: '3' })).toEqual({
      page: 3,
      q: 'Saúde',
    })
  })

  it('drops an empty query and an invalid page', () => {
    expect(parseSpeechCutListParams({ q: '   ', page: '0' })).toEqual({ page: 1 })
    expect(parseSpeechCutListParams({})).toEqual({ page: 1 })
  })
})

describe('serializeCanonicalSpeechCutListSearchParams', () => {
  it('omits the default page and serializes a real one', () => {
    expect(serializeCanonicalSpeechCutListSearchParams({ page: 1 }).toString()).toBe('')
    expect(serializeCanonicalSpeechCutListSearchParams({ page: 2 }).toString()).toBe('page=2')
  })

  it('canonicalizes through parse', () => {
    expect(
      serializeCanonicalSpeechCutListSearchParams(
        parseSpeechCutListParams({ q: 'obras', page: '1' }),
      ).toString(),
    ).toBe('q=obras')
  })
})

describe('buildSpeechCutListHref', () => {
  it('points at the library and clamps the page into the query', () => {
    expect(buildSpeechCutListHref(parseSpeechCutListParams({ q: 'SUS' }), 2)).toBe(
      '/campanha/comunicacao/acervo/cortes?q=SUS&page=2',
    )
    expect(buildSpeechCutListHref(parseSpeechCutListParams({}), 1)).toBe(
      '/campanha/comunicacao/acervo/cortes',
    )
  })
})

describe('resolveSpeechCutListUrl', () => {
  it('canonicalizes unsupported params into a redirect', () => {
    const resolved = resolveSpeechCutListUrl({ q: 'saude', desconhecido: 'x', page: '2' })
    expect(resolved.state.q).toBe('saude')
    expect(resolved.redirectHref).toBe('/campanha/comunicacao/acervo/cortes?q=saude&page=2')
  })

  it('clamps a page beyond the total', () => {
    const resolved = resolveSpeechCutListUrl({ q: 'saude', page: '9' }, 2)
    expect(resolved.state.page).toBe(2)
    expect(resolved.redirectHref).toContain('page=2')
  })
})

describe('buildSpeechCutFiltersKey', () => {
  it('is empty without filters and stable with them', () => {
    expect(buildSpeechCutFiltersKey(parseSpeechCutListParams({}))).toBe('')
    expect(buildSpeechCutFiltersKey(parseSpeechCutListParams({ q: 'obras' }))).toBe('q=obras')
  })
})

describe('buildSpeechCutListWhere', () => {
  it('is empty without a query', () => {
    expect(buildSpeechCutListWhere({ page: 1 })).toEqual({})
  })

  it('matches title or description', () => {
    expect(buildSpeechCutListWhere({ page: 1, q: 'SUS' })).toEqual({
      or: [{ title: { like: 'SUS' } }, { description: { like: 'SUS' } }],
    })
  })
})
