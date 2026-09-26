// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  ACERVO_SORT_OPTIONS,
  ACERVO_THEME_SORT_OPTIONS,
  acervoSortIsDuration,
  parseAcervoSort,
  parseAcervoThemeSort,
} from '@/lib/acervoListSort'

// C216 — the shared ordering vocabulary of the acervo (recordings C219 + web
// speeches): `recentes` is the default and never serialized, and only the two
// duration orders count as duration sorts (the `where` gate follows them).

describe('parseAcervoSort', () => {
  it('accepts only the non-default known orders', () => {
    expect(parseAcervoSort('duracao_maior')).toBe('duracao_maior')
    expect(parseAcervoSort('duracao_menor')).toBe('duracao_menor')
    expect(parseAcervoSort('recentes')).toBeUndefined()
    expect(parseAcervoSort('maratona')).toBeUndefined()
    expect(parseAcervoSort(undefined)).toBeUndefined()
    expect(parseAcervoSort(['duracao_maior', 'duracao_menor'])).toBe('duracao_maior')
  })
})

describe('acervoSortIsDuration', () => {
  it('flags only the duration orders', () => {
    expect(acervoSortIsDuration('duracao_maior')).toBe(true)
    expect(acervoSortIsDuration('duracao_menor')).toBe(true)
    expect(acervoSortIsDuration('recentes')).toBe(false)
    expect(acervoSortIsDuration(undefined)).toBe(false)
  })
})

describe('ACERVO_SORT_OPTIONS', () => {
  it('keeps the pt-BR labels of the approved control', () => {
    expect(ACERVO_SORT_OPTIONS).toEqual([
      { value: 'recentes', label: 'Mais recentes' },
      { value: 'duracao_maior', label: 'Duração (maior)' },
      { value: 'duracao_menor', label: 'Duração (menor)' },
    ])
  })
})

// C229 — the theme vocabulary of the speech acervo: relevance is the default
// and `recentes` must remain askable; recordings/Central keep the list above.
describe('theme sort vocabulary', () => {
  it('opens with relevance and keeps the shared options', () => {
    expect(ACERVO_THEME_SORT_OPTIONS).toEqual([
      { value: 'relevancia', label: 'Mais relevantes' },
      ...ACERVO_SORT_OPTIONS,
    ])
  })

  it('parses relevance and unknown values as the default', () => {
    expect(parseAcervoThemeSort('relevancia')).toBeUndefined()
    expect(parseAcervoThemeSort('maratona')).toBeUndefined()
    expect(parseAcervoThemeSort(undefined)).toBeUndefined()
  })

  it('keeps recentes and the duration orders meaningful', () => {
    expect(parseAcervoThemeSort('recentes')).toBe('recentes')
    expect(parseAcervoThemeSort('duracao_maior')).toBe('duracao_maior')
    expect(parseAcervoThemeSort('duracao_menor')).toBe('duracao_menor')
    expect(parseAcervoThemeSort(['recentes', 'duracao_maior'])).toBe('recentes')
  })
})
