import { describe, expect, it } from 'vitest'

import {
  civilDateDaysBetween,
  civilDateToUtcMidnightIso,
  formatBahiaCivilDate,
  subtractBahiaCivilDays,
} from '@/lib/campaignTime'

describe('Bahia civil date helpers (B57)', () => {
  it('converts civil dates to UTC midnight ISO anchors', () => {
    expect(civilDateToUtcMidnightIso('2026-08-01')).toBe('2026-08-01T00:00:00.000Z')
  })

  it('subtracts whole civil days', () => {
    expect(subtractBahiaCivilDays('2026-08-08', 7)).toBe('2026-08-01')
  })

  it('counts calendar days between civil dates', () => {
    expect(civilDateDaysBetween('2026-08-01', '2026-08-08')).toBe(7)
  })

  it('round-trips formatBahiaCivilDate through subtract', () => {
    const today = formatBahiaCivilDate(new Date('2026-08-08T15:00:00.000Z'))
    expect(today).toBe('2026-08-08')
    expect(subtractBahiaCivilDays(today, 7)).toBe('2026-08-01')
  })
})
