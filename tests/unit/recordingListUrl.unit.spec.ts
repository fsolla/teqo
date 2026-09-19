// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildAcervoSourceHref,
  buildRecordingListHref,
  parseAcervoSource,
  parseRecordingListParams,
  parseRecordingPeople,
  removeRecordingPerson,
  resolveRecordingListUrl,
  toggleRecordingPerson,
} from '@/utilities/recordings/recordingListUrl'

describe('recording list URL (C199)', () => {
  it('detects the enviadas source and defaults everything else to the Câmara', () => {
    expect(parseAcervoSource({ source: 'enviadas' })).toBe('enviadas')
    expect(parseAcervoSource({ source: 'camara' })).toBe('camara')
    expect(parseAcervoSource({ source: 'gravacoes' })).toBe('camara')
    expect(parseAcervoSource({})).toBe('camara')
  })

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
      year: '2026',
      topic: 'saude',
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

  it('builds the switcher hrefs (the Câmara side is the bare acervo)', () => {
    expect(buildAcervoSourceHref('enviadas')).toBe('/campanha/comunicacao/acervo?source=enviadas')
    expect(buildAcervoSourceHref('camara')).toBe('/campanha/comunicacao/acervo')
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
})
