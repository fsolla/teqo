import { describe, expect, it } from 'vitest'

import {
  allDayCivilDateOf,
  allDayEndInstant,
  allDayEndInstantFromExclusive,
  allDayExclusiveEndDate,
  allDayRangeValid,
  allDayStartInstant,
  formatAllDayRangeLabel,
  isCivilDate,
} from '@/lib/activityAllDay'

describe('activityAllDay civil date contract', () => {
  it('recognizes only aaaa-mm-dd values', () => {
    expect(isCivilDate('2026-08-10')).toBe(true)
    expect(isCivilDate('2026-8-10')).toBe(false)
    expect(isCivilDate('2026-08-10T09:00')).toBe(false)
    expect(isCivilDate('')).toBe(false)
  })
})

describe('activityAllDay storage instants', () => {
  it('anchors the start on Bahia midnight (fixed −03, no DST)', () => {
    expect(allDayStartInstant('2026-08-10')).toBe('2026-08-10T03:00:00.000Z')
  })

  it('anchors the inclusive end on the last day at Bahia midnight', () => {
    expect(allDayEndInstant('2026-08-12')).toBe('2026-08-12T03:00:00.000Z')
  })

  it('round-trips a stored instant back to its civil date', () => {
    expect(allDayCivilDateOf('2026-08-12T03:00:00.000Z')).toBe('2026-08-12')
  })

  it('rejects a malformed civil date defensively', () => {
    expect(() => allDayStartInstant('10/08/2026')).toThrow()
  })
})

describe('activityAllDay exclusive-end conversions (FullCalendar / iCal)', () => {
  it('derives the exclusive end as the day after the last stored day', () => {
    expect(allDayExclusiveEndDate('2026-08-12T03:00:00.000Z')).toBe('2026-08-13')
  })

  it('turns an exclusive end back into the stored inclusive instant', () => {
    expect(allDayEndInstantFromExclusive('2026-08-13')).toBe('2026-08-12T03:00:00.000Z')
  })

  it('keeps single-day events stable across the round trip', () => {
    const start = '2026-08-10T03:00:00.000Z'
    expect(allDayEndInstantFromExclusive(allDayExclusiveEndDate(start))).toBe(start)
  })

  it('crosses month and year boundaries', () => {
    expect(allDayExclusiveEndDate('2026-08-31T03:00:00.000Z')).toBe('2026-09-01')
    expect(allDayExclusiveEndDate('2026-12-31T03:00:00.000Z')).toBe('2027-01-01')
    expect(allDayEndInstantFromExclusive('2026-03-01')).toBe('2026-02-28T03:00:00.000Z')
  })
})

describe('activityAllDay range rules', () => {
  it('accepts a single-day range (end equals start)', () => {
    const start = '2026-08-10T03:00:00.000Z'
    expect(allDayRangeValid(start, start)).toBe(true)
  })

  it('accepts a multi-day range and rejects an inverted one', () => {
    const start = '2026-08-10T03:00:00.000Z'
    const end = '2026-08-12T03:00:00.000Z'
    expect(allDayRangeValid(start, end)).toBe(true)
    expect(allDayRangeValid(end, start)).toBe(false)
  })
})

describe('formatAllDayRangeLabel', () => {
  it('prints a single civil date for a one-day commitment', () => {
    expect(formatAllDayRangeLabel('2026-08-10T03:00:00.000Z')).toBe('10/08/2026')
  })

  it('prints the full range for a multi-day commitment', () => {
    expect(formatAllDayRangeLabel('2026-08-10T03:00:00.000Z', '2026-08-12T03:00:00.000Z')).toBe(
      '10/08/2026 a 12/08/2026',
    )
  })

  it('collapses a same-day range to the single date', () => {
    expect(formatAllDayRangeLabel('2026-08-10T03:00:00.000Z', '2026-08-10T03:00:00.000Z')).toBe(
      '10/08/2026',
    )
  })
})
