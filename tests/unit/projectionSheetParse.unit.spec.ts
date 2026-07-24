import { describe, expect, it } from 'vitest'

import {
  mapSheetPriority,
  parseExpectationCell,
  parseSheetNumber,
} from '@/lib/projectionSheetParse'

describe('parseSheetNumber', () => {
  it('parses Brazilian thousand separators', () => {
    expect(parseSheetNumber('10.000')).toBe(10000)
    expect(parseSheetNumber('1.400')).toBe(1400)
    expect(parseSheetNumber(350)).toBe(350)
  })

  it('returns null for empty or non-numeric', () => {
    expect(parseSheetNumber('')).toBeNull()
    expect(parseSheetNumber(null)).toBeNull()
    expect(parseSheetNumber('n/a')).toBeNull()
  })
})

describe('parseExpectationCell', () => {
  it('maps Bom/Regular/Mínimo onto optimistic/central/pessimistic', () => {
    expect(parseExpectationCell('Bom:200 | Regular: 150 | Minimo: 100')).toEqual({
      optimistic: 200,
      central: 150,
      pessimistic: 100,
    })
    expect(parseExpectationCell('Bom: 300 | Regular: 200 | Minimo: 100')).toEqual({
      optimistic: 300,
      central: 200,
      pessimistic: 100,
    })
    expect(parseExpectationCell('Bom: 200| Regular: 150| Minimo: 100')).toEqual({
      optimistic: 200,
      central: 150,
      pessimistic: 100,
    })
  })

  it('parses thousand separators inside labeled cells', () => {
    expect(parseExpectationCell('Bom: 2.000 | Regular: 1.500 | Minimo: 1.000')).toEqual({
      optimistic: 2000,
      central: 1500,
      pessimistic: 1000,
    })
    expect(parseExpectationCell('Bom: 10.000 | Regular: 8.000 | Minimo: 6.000')).toEqual({
      optimistic: 10000,
      central: 8000,
      pessimistic: 6000,
    })
  })

  it('accepts Mínimo with accent', () => {
    expect(parseExpectationCell('Bom: 100 | Regular: 80 | Mínimo: 50')).toEqual({
      optimistic: 100,
      central: 80,
      pessimistic: 50,
    })
  })

  it('parses slash format', () => {
    expect(parseExpectationCell('800/500/400')).toEqual({
      optimistic: 800,
      central: 500,
      pessimistic: 400,
    })
    expect(parseExpectationCell('300 /200 /100')).toEqual({
      optimistic: 300,
      central: 200,
      pessimistic: 100,
    })
  })

  it('tolerates backslash separators from sheet export glitches', () => {
    expect(parseExpectationCell('Bom:300 \\Regular:150\\ mínimo: 50')).toEqual({
      optimistic: 300,
      central: 150,
      pessimistic: 50,
    })
  })

  it('returns null for empty or unrecognized cells', () => {
    expect(parseExpectationCell(null)).toBeNull()
    expect(parseExpectationCell('')).toBeNull()
    expect(parseExpectationCell('Bom: 50 / regular: 30 / otmo: 100')).toBeNull()
  })
})

describe('mapSheetPriority', () => {
  it('maps alta to alta regardless of case', () => {
    expect(mapSheetPriority('alta')).toBe('alta')
    expect(mapSheetPriority('Alta')).toBe('alta')
    expect(mapSheetPriority(' ALTA ')).toBe('alta')
  })

  it('maps Baixa, empty, and unknown to normal', () => {
    expect(mapSheetPriority('Baixa')).toBe('normal')
    expect(mapSheetPriority('')).toBe('normal')
    expect(mapSheetPriority(null)).toBe('normal')
    expect(mapSheetPriority('média')).toBe('normal')
  })
})
