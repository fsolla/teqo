import { describe, expect, it } from 'vitest'

import {
  SUMMARY_POINTER_COPY,
  capList,
  excerptDeepDive,
  joinWithRemainder,
  moreItemsLabel,
  showingLabel,
  stripInlineSources,
  summaryListText,
  summarySurfaceText,
  summaryText,
} from '../../scripts/lib/reportText.mjs'

describe('stripInlineSources', () => {
  it('drops a trailing token and the stray space before punctuation', () => {
    expect(stripInlineSources('Pagamento pendente de confirmação {{fonte}}.')).toBe(
      'Pagamento pendente de confirmação.',
    )
  })

  it('drops indexed tokens and collapses the leftover spaces', () => {
    expect(stripInlineSources('Fato {{fonte:2}} e outro {{fonte:3}} aqui.')).toBe(
      'Fato e outro aqui.',
    )
  })

  it('leaves text without tokens untouched', () => {
    expect(stripInlineSources('Sem marcador de fonte.')).toBe('Sem marcador de fonte.')
  })
})

describe('excerptDeepDive (C188)', () => {
  it('cuts with an explicit ellipsis beyond the limit', () => {
    expect(excerptDeepDive('a'.repeat(10), 4)).toBe('aaaa…')
  })

  it('passes short text through untouched', () => {
    expect(excerptDeepDive('curto', 40)).toBe('curto')
  })

  it('is the only primitive that may print "…" (summary primitives never do)', () => {
    expect(excerptDeepDive('palavra '.repeat(30), 20)).toContain('…')
    expect(
      summarySurfaceText({ answer: 'palavra '.repeat(30) }, 'pointer').text.includes('…'),
    ).toBe(false)
    expect(joinWithRemainder(['a'.repeat(200), 'b'], 1).includes('…')).toBe(false)
    expect(summaryListText(['a'.repeat(200), 'b'], { limit: 1, max: 90 }).includes('…')).toBe(false)
    expect(moreItemsLabel(3, 'item', 'itens').includes('…')).toBe(false)
  })
})

describe('capList (C188)', () => {
  it('returns items, total and remaining — the tail is never silent', () => {
    expect(capList([1, 2, 3, 4, 5], 2)).toEqual({ items: [1, 2], total: 5, remaining: 3 })
  })

  it('handles an empty or short list without a phantom remainder', () => {
    expect(capList([], 4)).toEqual({ items: [], total: 0, remaining: 0 })
    expect(capList([1, 2], 4)).toEqual({ items: [1, 2], total: 2, remaining: 0 })
  })

  it('tolerates a non-array input', () => {
    expect(capList(null as unknown as number[], 4)).toEqual({ items: [], total: 0, remaining: 0 })
  })
})

describe('joinWithRemainder (C188)', () => {
  it('caps by count and states the remainder instead of cutting characters', () => {
    expect(joinWithRemainder(['Ana', 'Beto', 'Caio', 'Dora'], 2)).toBe('Ana, Beto e mais 2')
  })

  it('never truncates an individual value', () => {
    const long = 'Um nome bastante longo que não pode ser cortado no meio'
    expect(joinWithRemainder([long, 'Outro'], 1)).toBe(`${long} e mais 1`)
  })

  it('drops empty values and does not add a remainder when everything fits', () => {
    expect(joinWithRemainder(['Ana', null, 'Beto'], 2)).toBe('Ana, Beto')
  })
})

describe('summarySurfaceText (C188)', () => {
  it('prefers the researcher summary, even on the pointer pass', () => {
    const item = { summary: 'Resumo curto.', answer: 'Resposta integral longa.' }
    expect(summarySurfaceText(item, 'full')).toEqual({ text: 'Resumo curto.', fromSummary: true })
    expect(summarySurfaceText(item, 'pointer')).toEqual({
      text: 'Resumo curto.',
      fromSummary: true,
    })
  })

  it('degrades an un-summarized answer to the pointer only on the pointer pass', () => {
    const item = { summary: null, answer: 'Resposta integral.' }
    expect(summarySurfaceText(item, 'full')).toEqual({
      text: 'Resposta integral.',
      fromSummary: false,
    })
    expect(summarySurfaceText(item, 'pointer')).toEqual({
      text: SUMMARY_POINTER_COPY,
      fromSummary: false,
    })
    expect(SUMMARY_POINTER_COPY).not.toContain('…')
  })
})

describe('summaryListText (C188)', () => {
  it('keeps a short joined list with its counter', () => {
    expect(summaryListText(['Ana', 'Beto', 'Caio'], { limit: 2, max: 90 })).toBe(
      'Ana, Beto e mais 1',
    )
  })

  it('degrades an over-budget joined list to the pointer, never cutting with "…"', () => {
    const values = ['a'.repeat(120), 'b']
    expect(summaryListText(values, { limit: 1, max: 90, fallback: 'pointer' })).toBe(
      SUMMARY_POINTER_COPY,
    )
    const kept = summaryListText(values, { limit: 1, max: 90 })
    expect(kept.includes('…')).toBe(false)
    expect(kept.length).toBeGreaterThan(90)
  })
})

describe('summaryText (C188)', () => {
  it('prefers the researcher summary and flags its origin', () => {
    expect(
      summaryText({ summary: '  Resumo curto.  ', answer: 'Resposta integral longa.' }),
    ).toEqual({ text: 'Resumo curto.', fromSummary: true })
  })

  it('falls back to the full answer when there is no summary', () => {
    expect(summaryText({ summary: null, answer: 'Resposta integral.' })).toEqual({
      text: 'Resposta integral.',
      fromSummary: false,
    })
    expect(summaryText({ summary: '   ', answer: 'Resposta integral.' }).fromSummary).toBe(false)
  })

  it('exposes the pointer copy used when even the full answer does not fit', () => {
    expect(SUMMARY_POINTER_COPY).toBe('Texto integral no aprofundamento')
    expect(SUMMARY_POINTER_COPY).not.toContain('…')
  })
})

describe('counter copy (C188)', () => {
  it('builds "e mais N" with the right plural', () => {
    expect(moreItemsLabel(1, 'item', 'itens')).toBe('e mais 1 item')
    expect(moreItemsLabel(3, 'item', 'itens')).toBe('e mais 3 itens')
  })

  it('builds "Mostrando X de Y"', () => {
    expect(showingLabel(3, 10, 'liderança', 'lideranças')).toBe('Mostrando 3 de 10 lideranças')
  })
})
