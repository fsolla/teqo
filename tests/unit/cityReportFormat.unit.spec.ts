import { describe, expect, it } from 'vitest'

import {
  formatDateBr,
  formatFreshness,
  formatInteger,
  formatMoneyCompact,
  formatPercent,
  formatRank,
} from '../../scripts/lib/cityReportFormat.mjs'

describe('cityReportFormat', () => {
  it('formats integers in pt-BR', () => {
    expect(formatInteger(1234567)).toBe('1.234.567')
    expect(formatInteger(null)).toBe('—')
    expect(formatInteger(undefined)).toBe('—')
  })

  it('formats percents with one decimal', () => {
    expect(formatPercent(0.0321)).toBe('3,2%')
    expect(formatPercent(0)).toBe('0,0%')
    expect(formatPercent(null)).toBe('—')
  })

  it('formats money in millions', () => {
    expect(formatMoneyCompact(0)).toBe('R$ 0,0 mil')
    expect(formatMoneyCompact(250_000)).toBe('R$ 250 mil')
    expect(formatMoneyCompact(2_500_000)).toBe('R$ 2,5 mi')
    expect(formatMoneyCompact(1_500_000_000)).toBe('R$ 1,5 bi')
  })

  it('formats dates in pt-BR', () => {
    expect(formatDateBr('2026-09-15T12:00:00.000Z')).toBe('15/09/2026')
    expect(formatDateBr(null)).toBe('—')
  })

  it('formats freshness buckets', () => {
    const now = new Date('2026-09-15T12:00:00.000Z')
    expect(formatFreshness('2026-09-15T09:00:00.000Z', now)).toBe('atualizado hoje')
    expect(formatFreshness('2026-09-13T12:00:00.000Z', now)).toBe('atualizado há 2 dias')
    expect(formatFreshness('2026-09-01T12:00:00.000Z', now)).toBe('atualizado há 2 semanas')
    expect(formatFreshness(null, now)).toBe('sem registro')
  })

  it('formats rank', () => {
    expect(formatRank({ rank: 7, totalUnits: 435 })).toBe('7º de 435')
    expect(formatRank(null)).toBe('—')
  })
})
