import { describe, expect, it } from 'vitest'

import {
  formatHomeSummaryDeltaMagnitude,
  homeSummaryDeltaAriaLabel,
  resolveHomeSummaryDeltaDirection,
  shouldShowHomeSummaryDelta,
} from '@/lib/campaignHomeSummaryDelta'

describe('campaignHomeSummaryDelta', () => {
  it('classifies direction from signed delta', () => {
    expect(resolveHomeSummaryDeltaDirection(1_500)).toBe('up')
    expect(resolveHomeSummaryDeltaDirection(-200)).toBe('down')
    expect(resolveHomeSummaryDeltaDirection(0)).toBe('flat')
    expect(resolveHomeSummaryDeltaDirection(null)).toBe('unavailable')
  })

  it('formats magnitude as absolute pt-BR integer votes', () => {
    expect(formatHomeSummaryDeltaMagnitude(12_345)).toBe('12.345')
    expect(formatHomeSummaryDeltaMagnitude(-12_345)).toBe('12.345')
    expect(formatHomeSummaryDeltaMagnitude(null)).toBeNull()
  })

  it('shows zero magnitude for a flat delta', () => {
    expect(formatHomeSummaryDeltaMagnitude(0)).toBe('0')
  })

  it('spells out aria labels with direction and magnitude', () => {
    expect(homeSummaryDeltaAriaLabel(500)).toBe('Aumento de 500 votos nos últimos 7 dias')
    expect(homeSummaryDeltaAriaLabel(-500)).toBe('Queda de 500 votos nos últimos 7 dias')
    expect(homeSummaryDeltaAriaLabel(0)).toBe('Sem variação nos últimos 7 dias')
    expect(homeSummaryDeltaAriaLabel(null)).toBe('Variação nos últimos 7 dias indisponível')
  })

  it('shows the delta chip only when movement occurred', () => {
    expect(shouldShowHomeSummaryDelta(500)).toBe(true)
    expect(shouldShowHomeSummaryDelta(-200)).toBe(true)
    expect(shouldShowHomeSummaryDelta(0)).toBe(false)
    expect(shouldShowHomeSummaryDelta(null)).toBe(false)
  })
})
