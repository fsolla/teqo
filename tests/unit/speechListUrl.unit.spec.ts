// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { SPEECH_SCOPES, SPEECH_TOPICS } from '@/lib/speechFacets'
import {
  buildSpeechFiltersKey,
  buildSpeechListHref,
  parseSpeechListParams,
  resolveSpeechListUrl,
  serializeCanonicalSpeechListSearchParams,
  speechHasActiveFilters,
  webSpeechSortOrder,
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

  it('parses the theme mode and ignores any other value (C192)', () => {
    expect(parseSpeechListParams({ q: 'SUS', mode: 'tema' }).mode).toBe('tema')
    expect(parseSpeechListParams({ q: 'SUS', mode: 'termo' }).mode).toBeUndefined()
    expect(parseSpeechListParams({ q: 'SUS', mode: 'exato' }).mode).toBeUndefined()
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

  it('serializes mode=tema only alongside a query (C192)', () => {
    expect(
      serializeCanonicalSpeechListSearchParams(
        parseSpeechListParams({ q: 'SUS', mode: 'tema' }),
      ).toString(),
    ).toBe('q=SUS&mode=tema')
    // A theme without a query canonicalizes away.
    expect(
      serializeCanonicalSpeechListSearchParams(parseSpeechListParams({ mode: 'tema' })).toString(),
    ).toBe('')
  })
})

describe('buildSpeechListHref', () => {
  it('points at the acervo and clamps the page into the query', () => {
    expect(buildSpeechListHref(parseSpeechListParams({ q: 'SUS' }), 2)).toBe(
      '/campanha/comunicacao/acervo?q=SUS&page=2',
    )
    expect(buildSpeechListHref(parseSpeechListParams({}), 1)).toBe('/campanha/comunicacao/acervo')
  })

  it('keeps the exact-search deep link byte-identical (C192)', () => {
    expect(buildSpeechListHref(parseSpeechListParams({ q: 'SUS' }), 1)).toBe(
      '/campanha/comunicacao/acervo?q=SUS',
    )
    expect(buildSpeechListHref(parseSpeechListParams({ q: 'SUS', mode: 'tema' }), 1)).toBe(
      '/campanha/comunicacao/acervo?q=SUS&mode=tema',
    )
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

  it('canonicalizes a theme mode without a query into a redirect (C192)', () => {
    const withQuery = resolveSpeechListUrl({ q: 'SUS', mode: 'tema' })
    expect(withQuery.state.mode).toBe('tema')
    expect(withQuery.redirectHref).toBeUndefined()

    const empty = resolveSpeechListUrl({ mode: 'tema' })
    expect(empty.redirectHref).toBe('/campanha/comunicacao/acervo')
  })
})

describe('buildSpeechFiltersKey', () => {
  it('is empty without filters and stable with them', () => {
    expect(buildSpeechFiltersKey(parseSpeechListParams({}))).toBe('')
    expect(buildSpeechFiltersKey(parseSpeechListParams({ topic: ['saude'] }))).toBe('topic=saude')
  })
})

// C216 — the web speeches source lives in the same contract, additively: the
// Câmara URLs above stay byte-identical, and only `source=internet` turns on
// the web state (source always serialized, sort, no Fase).
describe('web speeches source (C216)', () => {
  it('parses the web state and ignores the Câmara-only phase param', () => {
    const state = parseSpeechListParams({
      source: 'internet',
      q: 'saúde pública',
      topic: ['saude'],
      phase: ['Breves Comunicações'],
      page: '2',
    })

    expect(state).toEqual({
      source: 'internet',
      page: 2,
      q: 'saúde pública',
      topics: ['saude'],
    })
  })

  it('keeps an unknown source on the Câmara (fail-closed)', () => {
    expect(parseSpeechListParams({ source: 'web' }).source).toBeUndefined()
    expect(parseSpeechListParams({ source: 'web', q: 'SUS' }).source).toBeUndefined()
  })

  it('parses the sort only for the web source and drops the default', () => {
    expect(parseSpeechListParams({ source: 'internet', sort: 'duracao_maior' }).sort).toBe(
      'duracao_maior',
    )
    expect(parseSpeechListParams({ source: 'internet', sort: 'recentes' }).sort).toBeUndefined()
    expect(parseSpeechListParams({ source: 'internet', sort: 'maratona' }).sort).toBeUndefined()
    // A Câmara URL never carries the sort, not even when the param is present.
    expect(parseSpeechListParams({ sort: 'duracao_maior' }).sort).toBeUndefined()
  })

  it('serializes `source=internet` always and the sort only when non-default', () => {
    expect(
      serializeCanonicalSpeechListSearchParams(
        parseSpeechListParams({ source: 'internet', q: 'SUS', sort: 'duracao_menor' }),
      ).toString(),
    ).toBe('source=internet&q=SUS&sort=duracao_menor')

    expect(
      serializeCanonicalSpeechListSearchParams(
        parseSpeechListParams({ source: 'internet', q: 'SUS', sort: 'recentes', phase: 'X' }),
      ).toString(),
    ).toBe('source=internet&q=SUS')
  })

  it('builds the canonical web hrefs on the same acervo path', () => {
    const state = parseSpeechListParams({ source: 'internet', q: 'SUS' })
    expect(buildSpeechListHref(state, 1)).toBe('/campanha/comunicacao/acervo?source=internet&q=SUS')
    expect(buildSpeechListHref(state, 2)).toBe(
      '/campanha/comunicacao/acervo?source=internet&q=SUS&page=2',
    )
    expect(buildSpeechFiltersKey(state)).toBe('source=internet&q=SUS')
  })

  it('redirects a phase on the web source away (canonicalization)', () => {
    const resolved = resolveSpeechListUrl({ source: 'internet', q: 'SUS', phase: 'Ordem do Dia' })
    expect(resolved.state.phases).toBeUndefined()
    expect(resolved.redirectHref).toBe('/campanha/comunicacao/acervo?source=internet&q=SUS')
  })

  it('maps the sort to the speech order and gates the duration sorts', () => {
    expect(webSpeechSortOrder(parseSpeechListParams({ source: 'internet' }))).toBe('-speechAt')
    expect(
      webSpeechSortOrder(parseSpeechListParams({ source: 'internet', sort: 'duracao_maior' })),
    ).toBe('-durationSeconds')
    expect(
      webSpeechSortOrder(parseSpeechListParams({ source: 'internet', sort: 'duracao_menor' })),
    ).toBe('durationSeconds')
  })

  it('tells an active filter from the source discriminator', () => {
    expect(speechHasActiveFilters(parseSpeechListParams({ source: 'internet' }))).toBe(false)
    expect(speechHasActiveFilters(parseSpeechListParams({ source: 'internet', q: 'SUS' }))).toBe(
      true,
    )
    expect(speechHasActiveFilters(parseSpeechListParams({ q: 'SUS' }))).toBe(true)
    expect(speechHasActiveFilters(parseSpeechListParams({}))).toBe(false)
  })
})

// C229 — the theme mode of the web source: relevance is the default and
// `recentes` becomes a real state that must serialize; the exact mode keeps
// its bytes and the Câmara keeps no sort at all.
describe('theme sort of the web source (C229)', () => {
  const themeParams = { source: 'internet', q: 'combate à oposição', mode: 'tema' } as const

  it('parses the theme sort with relevance and unknown values as the default', () => {
    expect(parseSpeechListParams({ ...themeParams, sort: 'recentes' }).sort).toBe('recentes')
    expect(parseSpeechListParams({ ...themeParams, sort: 'duracao_maior' }).sort).toBe(
      'duracao_maior',
    )
    expect(parseSpeechListParams({ ...themeParams, sort: 'relevancia' }).sort).toBeUndefined()
    expect(parseSpeechListParams({ ...themeParams, sort: 'maratona' }).sort).toBeUndefined()
    // The Câmara contract never carries a sort, not even in the theme mode.
    expect(parseSpeechListParams({ q: 'SUS', mode: 'tema', sort: 'recentes' }).sort).toBeUndefined()
  })

  it('serializes an explicit recentes in the theme mode only', () => {
    expect(
      serializeCanonicalSpeechListSearchParams(
        parseSpeechListParams({ ...themeParams, sort: 'recentes' }),
      ).toString(),
    ).toBe('source=internet&q=combate+%C3%A0+oposi%C3%A7%C3%A3o&mode=tema&sort=recentes')
    // Relevance and unknown values canonicalize away.
    expect(
      serializeCanonicalSpeechListSearchParams(
        parseSpeechListParams({ ...themeParams, sort: 'relevancia' }),
      ).get('sort'),
    ).toBeNull()
    // The exact mode still omits its own default.
    expect(
      serializeCanonicalSpeechListSearchParams(
        parseSpeechListParams({ source: 'internet', q: 'SUS', sort: 'recentes' }),
      ).get('sort'),
    ).toBeNull()
  })

  it('canonicalizes relevance and unknown theme sorts into a redirect', () => {
    const relevance = resolveSpeechListUrl({ ...themeParams, sort: 'relevancia' })
    expect(relevance.state.sort).toBeUndefined()
    expect(relevance.redirectHref).toBe(
      '/campanha/comunicacao/acervo?source=internet&q=combate+%C3%A0+oposi%C3%A7%C3%A3o&mode=tema',
    )

    const unknown = resolveSpeechListUrl({ ...themeParams, sort: 'maratona' })
    expect(unknown.redirectHref).toBe(
      '/campanha/comunicacao/acervo?source=internet&q=combate+%C3%A0+oposi%C3%A7%C3%A3o&mode=tema',
    )
  })

  it('keeps the canonical round-trip of an explicit theme order', () => {
    const state = parseSpeechListParams({ ...themeParams, sort: 'recentes' })
    expect(buildSpeechListHref(state, 2)).toBe(
      '/campanha/comunicacao/acervo?source=internet&q=combate+%C3%A0+oposi%C3%A7%C3%A3o&mode=tema&sort=recentes&page=2',
    )
    expect(resolveSpeechListUrl({ ...themeParams, sort: 'recentes' }).redirectHref).toBeUndefined()
  })
})
