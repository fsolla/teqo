// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { SPEECH_TOPICS } from '@/lib/speechFacets'
import {
  buildRecordingFiltersKey,
  buildRecordingListHref,
  parseRecordingListParams,
  parseRecordingPeople,
  recordingHasActiveFilters,
  recordingSortIsDuration,
  recordingSortOrder,
  removeRecordingPerson,
  resolveRecordingListUrl,
  toggleRecordingPerson,
} from '@/utilities/recordings/recordingListUrl'
import { SPEECH_DURATION_BUCKETS } from '@/utilities/speech/speechListUrl'

describe('recording list URL (C199)', () => {
  it('parses the canonical state and rejects an unready query', () => {
    expect(parseRecordingListParams({ source: 'enviadas', q: 'merenda', page: '3' })).toEqual({
      source: 'enviadas',
      page: 3,
      q: 'merenda',
    })
    // One character is not a ready search query (same rule as contact search).
    expect(parseRecordingListParams({ source: 'enviadas', q: 'a' })).toEqual({
      source: 'enviadas',
      page: 1,
    })
    expect(parseRecordingListParams({ source: 'enviadas', page: '0' }).page).toBe(1)
  })

  it('keeps `source=enviadas` in the canonical href and drops unsupported params', () => {
    const canonical = resolveRecordingListUrl({ source: 'enviadas', q: 'merenda' })
    expect(canonical.state).toEqual({ source: 'enviadas', page: 1, q: 'merenda' })
    expect(canonical.href).toBe('/campanha/comunicacao/acervo?source=enviadas&q=merenda')
    expect(canonical.redirectHref).toBeUndefined()

    const polluted = resolveRecordingListUrl({
      source: 'enviadas',
      q: 'merenda',
      phase: 'Ordem do Dia',
      foo: 'bar',
    })
    expect(polluted.redirectHref).toBe('/campanha/comunicacao/acervo?source=enviadas&q=merenda')

    const unready = resolveRecordingListUrl({ source: 'enviadas', q: 'a' })
    expect(unready.href).toBe('/campanha/comunicacao/acervo?source=enviadas')
    expect(unready.redirectHref).toBe('/campanha/comunicacao/acervo?source=enviadas')
  })

  it('clamps the page to the last one and builds pagination hrefs', () => {
    const clamped = resolveRecordingListUrl({ source: 'enviadas', page: '9' }, 3)
    expect(clamped.state.page).toBe(3)
    expect(clamped.href).toBe('/campanha/comunicacao/acervo?source=enviadas&page=3')

    expect(buildRecordingListHref({ source: 'enviadas', page: 1 }, 2)).toBe(
      '/campanha/comunicacao/acervo?source=enviadas&page=2',
    )
    expect(buildRecordingListHref({ source: 'enviadas', page: 2 }, 1)).toBe(
      '/campanha/comunicacao/acervo?source=enviadas',
    )
  })

  it('parses repeated `person` values: trim, oversized drop, case-insensitive dedupe', () => {
    expect(parseRecordingPeople([' Solla ', 'solla', 'Presidente'])).toEqual([
      'Solla',
      'Presidente',
    ])
    expect(parseRecordingPeople(undefined)).toEqual([])
    expect(parseRecordingPeople('')).toEqual([])
    expect(parseRecordingPeople('x'.repeat(121))).toEqual([])
  })

  it('canonicalizes and serializes the `person` facet with the query', () => {
    const parsed = parseRecordingListParams({
      source: 'enviadas',
      q: 'merenda',
      person: ['Solla', 'Presidente'],
    })
    expect(parsed.people).toEqual(['Solla', 'Presidente'])

    const canonical = resolveRecordingListUrl({
      source: 'enviadas',
      q: 'merenda',
      person: ['Solla', 'Presidente'],
    })
    expect(canonical.href).toBe(
      '/campanha/comunicacao/acervo?source=enviadas&q=merenda&person=Solla&person=Presidente',
    )
    expect(canonical.redirectHref).toBeUndefined()
  })

  it('drops a duplicated facet value on canonicalization', () => {
    const canonical = resolveRecordingListUrl({
      source: 'enviadas',
      person: ['Solla', 'solla', 'x'.repeat(200)],
    })
    expect(canonical.href).toBe('/campanha/comunicacao/acervo?source=enviadas&person=Solla')
    expect(canonical.redirectHref).toBe('/campanha/comunicacao/acervo?source=enviadas&person=Solla')
  })

  it('toggles and removes one person, resetting to the first page', () => {
    const base = { source: 'enviadas' as const, page: 3, q: 'merenda' }

    const added = toggleRecordingPerson(base, 'Solla')
    expect(added).toEqual({ ...base, page: 1, people: ['Solla'] })

    const removed = toggleRecordingPerson({ ...base, people: ['Solla'] }, 'solla')
    expect(removed).toEqual({ ...base, page: 1, people: undefined })

    expect(removeRecordingPerson({ ...base, people: ['Solla', 'Presidente'] }, 'Solla')).toEqual({
      ...base,
      page: 1,
      people: ['Presidente'],
    })
    expect(removeRecordingPerson({ ...base, people: ['Solla'] }, 'Solla')).toEqual({
      ...base,
      page: 1,
      people: undefined,
    })
  })

  it('parses the C219 parity facets and serializes them in canonical order', () => {
    const canonical = resolveRecordingListUrl({
      source: 'enviadas',
      q: 'merenda',
      mode: 'tema',
      year: ['2026', '2024'],
      topic: 'saude',
      scope: 'bahia',
      municipality: '42',
      duration: 'curta',
      sort: 'duracao_maior',
      person: 'Solla',
      page: '2',
    })
    expect(canonical.state).toEqual({
      source: 'enviadas',
      page: 2,
      q: 'merenda',
      mode: 'tema',
      years: [2026, 2024],
      topics: ['saude'],
      scopes: ['bahia'],
      municipalities: [42],
      durations: ['curta'],
      sort: 'duracao_maior',
      people: ['Solla'],
    })
    expect(canonical.href).toBe(
      '/campanha/comunicacao/acervo?source=enviadas&q=merenda&mode=tema&year=2026&year=2024' +
        '&topic=saude&scope=bahia&municipality=42&duration=curta&sort=duracao_maior&person=Solla&page=2',
    )
    expect(canonical.redirectHref).toBeUndefined()
  })

  it('keeps the C199 deep link byte-identical (no new param is serialized)', () => {
    const canonical = resolveRecordingListUrl({
      source: 'enviadas',
      q: 'merenda',
      person: ['Solla', 'Presidente'],
      page: '2',
    })
    expect(canonical.href).toBe(
      '/campanha/comunicacao/acervo?source=enviadas&q=merenda&person=Solla&person=Presidente&page=2',
    )
    expect(canonical.redirectHref).toBeUndefined()
  })

  it('canonicalizes the default sort and a theme without a query away', () => {
    const defaultSort = resolveRecordingListUrl({ source: 'enviadas', sort: 'recentes' })
    expect(defaultSort.state.sort).toBeUndefined()
    expect(defaultSort.href).toBe('/campanha/comunicacao/acervo?source=enviadas')
    expect(defaultSort.redirectHref).toBe(defaultSort.href)

    // The parsed state keeps `mode`, but the canonical href drops it and the
    // redirect lands on the URL without the meaningless param (same as Câmara).
    const themeWithoutQuery = resolveRecordingListUrl({ source: 'enviadas', mode: 'tema' })
    expect(themeWithoutQuery.state.mode).toBe('tema')
    expect(themeWithoutQuery.href).toBe('/campanha/comunicacao/acervo?source=enviadas')
    expect(themeWithoutQuery.redirectHref).toBe(themeWithoutQuery.href)

    // An unknown sort value can never widen the contract: it canonicalizes away.
    const unknownSort = resolveRecordingListUrl({ source: 'enviadas', sort: 'aleatorio' })
    expect(unknownSort.state.sort).toBeUndefined()
    expect(unknownSort.redirectHref).toBe(unknownSort.href)
  })

  it('collapses an exhaustive enum selection to no filter (same rule as the Câmara)', () => {
    const allTopics = resolveRecordingListUrl({
      source: 'enviadas',
      topic: SPEECH_TOPICS.map(({ value }) => value),
    })
    expect(allTopics.state.topics).toBeUndefined()
    expect(allTopics.href).toBe('/campanha/comunicacao/acervo?source=enviadas')

    const allDurations = resolveRecordingListUrl({
      source: 'enviadas',
      duration: SPEECH_DURATION_BUCKETS.map(({ value }) => value),
    })
    expect(allDurations.state.durations).toBeUndefined()
    expect(allDurations.href).toBe('/campanha/comunicacao/acervo?source=enviadas')
  })

  it('drops structurally invalid year/municipality values on canonicalization', () => {
    const canonical = resolveRecordingListUrl({
      source: 'enviadas',
      year: ['1800', 'abc', '2026'],
      municipality: ['-3', '0', '7'],
    })
    expect(canonical.state.years).toEqual([2026])
    expect(canonical.state.municipalities).toEqual([7])
    expect(canonical.href).toBe(
      '/campanha/comunicacao/acervo?source=enviadas&year=2026&municipality=7',
    )
  })

  it('exposes the canonical filter key and the Payload sort of each order', () => {
    expect(
      buildRecordingFiltersKey({ source: 'enviadas', page: 1, q: 'merenda', topics: ['saude'] }),
    ).toBe('source=enviadas&q=merenda&topic=saude')

    expect(recordingSortOrder({ source: 'enviadas', page: 1 })).toBe('-createdAt')
    expect(recordingSortOrder({ source: 'enviadas', page: 1, sort: 'duracao_maior' })).toBe(
      '-durationSeconds',
    )
    expect(recordingSortOrder({ source: 'enviadas', page: 1, sort: 'duracao_menor' })).toBe(
      'durationSeconds',
    )
    expect(recordingSortIsDuration({ source: 'enviadas', page: 1 })).toBe(false)
    expect(recordingSortIsDuration({ source: 'enviadas', page: 1, sort: 'duracao_maior' })).toBe(
      true,
    )
  })

  it('tells an unfiltered page (including pagination) from a narrowed one', () => {
    expect(recordingHasActiveFilters({ source: 'enviadas', page: 1 })).toBe(false)
    expect(recordingHasActiveFilters({ source: 'enviadas', page: 4 })).toBe(false)
    expect(recordingHasActiveFilters({ source: 'enviadas', page: 1, sort: 'duracao_maior' })).toBe(
      false,
    )
    expect(recordingHasActiveFilters({ source: 'enviadas', page: 1, q: 'merenda' })).toBe(true)
    expect(recordingHasActiveFilters({ source: 'enviadas', page: 1, years: [2026] })).toBe(true)
    expect(recordingHasActiveFilters({ source: 'enviadas', page: 1, people: ['Solla'] })).toBe(true)
  })
})
