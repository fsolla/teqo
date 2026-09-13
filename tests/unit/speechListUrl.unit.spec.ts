// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { SPEECH_SCOPES, SPEECH_TOPICS } from '@/lib/speechFacets'
import {
  buildSpeechFiltersKey,
  buildSpeechListHref,
  parseSpeechListParams,
  resolveSpeechListUrl,
  serializeCanonicalSpeechListSearchParams,
} from '@/utilities/speech/speechListUrl'

describe('parseSpeechListParams', () => {
  it('parses the canonical facets and keeps the page', () => {
    const state = parseSpeechListParams({
      q: 'Farmácia Popular',
      year: ['2026', '2025'],
      topic: ['saude', 'educacao'],
      scope: ['bahia'],
      phase: ['Breves Comunicações'],
      municipality: ['12', '999999'],
      duration: ['curta', 'longa'],
      page: '3',
    })

    expect(state).toEqual({
      page: 3,
      q: 'Farmácia Popular',
      years: [2026, 2025],
      topics: ['saude', 'educacao'],
      scopes: ['bahia'],
      phases: ['Breves Comunicações'],
      municipalities: [12, 999999],
      durations: ['curta', 'longa'],
    })
  })

  it('collapses an exhaustive enum to "no filter"', () => {
    const state = parseSpeechListParams({
      topic: SPEECH_TOPICS.map(({ value }) => value),
      scope: SPEECH_SCOPES.map(({ value }) => value),
    })
    expect(state.topics).toBeUndefined()
    expect(state.scopes).toBeUndefined()
  })

  it('validates data-driven params structurally', () => {
    const state = parseSpeechListParams({
      year: ['99', '2026', '0000'],
      municipality: ['0', '-4', '7'],
      phase: ['x'.repeat(81), 'Plenário'],
      q: 'a',
      page: '0',
    })

    expect(state.years).toEqual([2026])
    expect(state.municipalities).toEqual([7])
    expect(state.phases).toEqual(['Plenário'])
    // One-character search is not ready — the same rule as contact search.
    expect(state.q).toBeUndefined()
    expect(state.page).toBe(1)
  })

  it('drops unknown enum tokens', () => {
    const state = parseSpeechListParams({ topic: 'inexistente', duration: 'maratona' })
    expect(state.topics).toBeUndefined()
    expect(state.durations).toBeUndefined()
  })
})

describe('serializeCanonicalSpeechListSearchParams', () => {
  it('canonicalizes through parse and omits defaults', () => {
    const params = serializeCanonicalSpeechListSearchParams(
      parseSpeechListParams({ topic: ['saude'], page: '1' }),
    )
    expect(params.toString()).toBe('topic=saude')
  })

  it('keeps every value of a multi-select facet', () => {
    const params = serializeCanonicalSpeechListSearchParams(
      parseSpeechListParams({ topic: ['saude', 'educacao'], duration: ['curta'] }),
    )
    expect(params.getAll('topic')).toEqual(['saude', 'educacao'])
    expect(params.getAll('duration')).toEqual(['curta'])
  })
})

describe('buildSpeechListHref', () => {
  it('points at the acervo and clamps the page into the query', () => {
    expect(buildSpeechListHref(parseSpeechListParams({ q: 'SUS' }), 2)).toBe(
      '/campanha/comunicacao/acervo?q=SUS&page=2',
    )
    expect(buildSpeechListHref(parseSpeechListParams({}), 1)).toBe('/campanha/comunicacao/acervo')
  })
})

describe('resolveSpeechListUrl', () => {
  it('canonicalizes unsupported params into a redirect', () => {
    const resolved = resolveSpeechListUrl({ q: 'saude', desconhecido: 'x', page: '2' })
    expect(resolved.state.q).toBe('saude')
    expect(resolved.redirectHref).toBe('/campanha/comunicacao/acervo?q=saude&page=2')
  })

  it('clamps a page beyond the total', () => {
    const resolved = resolveSpeechListUrl({ q: 'saude', page: '9' }, 2)
    expect(resolved.state.page).toBe(2)
    expect(resolved.redirectHref).toContain('page=2')
  })
})

describe('buildSpeechFiltersKey', () => {
  it('is empty without filters and stable with them', () => {
    expect(buildSpeechFiltersKey(parseSpeechListParams({}))).toBe('')
    expect(buildSpeechFiltersKey(parseSpeechListParams({ topic: ['saude'] }))).toBe('topic=saude')
  })
})
