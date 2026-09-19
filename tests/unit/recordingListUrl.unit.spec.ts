// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildAcervoSourceHref,
  buildRecordingListHref,
  parseAcervoSource,
  parseRecordingListParams,
  resolveRecordingListUrl,
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
})
