// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { buildAcervoSourceHref, parseAcervoSource } from '@/lib/acervoSource'

// C216 — the shared source vocabulary moved out of the recordings contract so
// the speech URL contract can use it without a cycle; the Câmara default stays
// fail-closed for anything that is not an explicit source value.

describe('parseAcervoSource', () => {
  it('detects each explicit source and defaults everything else to the Câmara', () => {
    expect(parseAcervoSource({ source: 'enviadas' })).toBe('enviadas')
    expect(parseAcervoSource({ source: 'internet' })).toBe('internet')
    expect(parseAcervoSource({ source: 'camara' })).toBe('camara')
    expect(parseAcervoSource({ source: 'gravacoes' })).toBe('camara')
    expect(parseAcervoSource({ source: 'web' })).toBe('camara')
    expect(parseAcervoSource({})).toBe('camara')
  })

  it('takes the first value of a repeated param', () => {
    expect(parseAcervoSource({ source: ['internet', 'enviadas'] })).toBe('internet')
  })
})

describe('buildAcervoSourceHref', () => {
  it('builds the switcher hrefs (the Câmara side is the bare acervo)', () => {
    expect(buildAcervoSourceHref('enviadas')).toBe('/campanha/comunicacao/acervo?source=enviadas')
    expect(buildAcervoSourceHref('internet')).toBe('/campanha/comunicacao/acervo?source=internet')
    expect(buildAcervoSourceHref('camara')).toBe('/campanha/comunicacao/acervo')
  })
})
