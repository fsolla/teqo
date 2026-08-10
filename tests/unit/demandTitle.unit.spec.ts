import { describe, expect, it } from 'vitest'

import {
  DEMAND_TITLE_MAX_LENGTH,
  fallbackDemandTitle,
  isUsableDemandTitle,
} from '@/lib/demandTitle'

describe('fallbackDemandTitle', () => {
  it('collapses whitespace to a single line', () => {
    expect(fallbackDemandTitle('  Panfletos para a\nfeira de sábado  ')).toBe(
      'Panfletos para a feira de sábado',
    )
  })

  it('truncates to the title bound', () => {
    const long = 'x'.repeat(DEMAND_TITLE_MAX_LENGTH + 50)
    expect(fallbackDemandTitle(long)).toHaveLength(DEMAND_TITLE_MAX_LENGTH)
  })

  it('strips whitespace left behind by the slice', () => {
    const value = `${'y'.repeat(DEMAND_TITLE_MAX_LENGTH - 1)}   zzz`
    expect(fallbackDemandTitle(value)).toBe('y'.repeat(DEMAND_TITLE_MAX_LENGTH - 1))
  })

  it('keeps empty input empty (the collection letters-or-numbers check rejects it)', () => {
    expect(fallbackDemandTitle('   ')).toBe('')
  })
})

describe('isUsableDemandTitle', () => {
  it('accepts a short descriptive title', () => {
    expect(isUsableDemandTitle('500 santinhos para a feira')).toBe(true)
  })

  it('accepts the exact window edges', () => {
    expect(isUsableDemandTitle('ab')).toBe(true)
    expect(isUsableDemandTitle('x'.repeat(DEMAND_TITLE_MAX_LENGTH))).toBe(true)
  })

  it('rejects punctuation-only output (no URL slug)', () => {
    expect(isUsableDemandTitle('???')).toBe(false)
  })

  it('rejects a title beyond the bound', () => {
    expect(isUsableDemandTitle('x'.repeat(DEMAND_TITLE_MAX_LENGTH + 1))).toBe(false)
  })

  it('rejects a single character', () => {
    expect(isUsableDemandTitle('a')).toBe(false)
  })
})
