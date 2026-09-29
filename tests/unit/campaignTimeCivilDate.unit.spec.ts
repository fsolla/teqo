import { describe, expect, it } from 'vitest'

import {
  civilDateDaysBetween,
  civilDateToUtcMidnightIso,
  floorToMinuteStep,
  formatBahiaCalendarDateTime,
  formatBahiaCivilDate,
  formatBahiaCivilDateTimeLabel,
  formatBahiaEventDateLabel,
  formatCivilDateLabel,
  hourOptions,
  minuteOptionsForStep,
  subtractBahiaCivilDays,
  subtractBahiaCivilMonths,
  timeStepMinutes,
} from '@/lib/campaignTime'

describe('Bahia civil date helpers (B57)', () => {
  it('converts civil dates to UTC midnight ISO anchors', () => {
    expect(civilDateToUtcMidnightIso('2026-08-01')).toBe('2026-08-01T00:00:00.000Z')
  })

  it('subtracts whole civil days', () => {
    expect(subtractBahiaCivilDays('2026-08-08', 7)).toBe('2026-08-01')
  })

  it('subtracts whole civil months, clamping the day to the target month', () => {
    expect(subtractBahiaCivilMonths('2026-08-31', 6)).toBe('2026-02-28')
    expect(subtractBahiaCivilMonths('2024-08-31', 6)).toBe('2024-02-29')
    expect(subtractBahiaCivilMonths('2026-03-15', 6)).toBe('2025-09-15')
    expect(subtractBahiaCivilMonths('2026-01-15', 1)).toBe('2025-12-15')
  })

  it('formats a Bahia civil date anchor as a pt-BR day label', () => {
    expect(formatCivilDateLabel('2026-08-01')).toBe('01/08/2026')
  })

  it('counts calendar days between civil dates', () => {
    expect(civilDateDaysBetween('2026-08-01', '2026-08-08')).toBe(7)
  })

  it('round-trips formatBahiaCivilDate through subtract', () => {
    const today = formatBahiaCivilDate(new Date('2026-08-08T15:00:00.000Z'))
    expect(today).toBe('2026-08-08')
    expect(subtractBahiaCivilDays(today, 7)).toBe('2026-08-01')
  })

  it('formats a calendar instant as Bahia local time with seconds', () => {
    expect(formatBahiaCalendarDateTime(new Date('2026-10-03T22:00:00.000Z'))).toBe(
      '20261003T190000',
    )
  })
})

describe('Bahia civil datetime picker helpers (C97)', () => {
  it('labels civil datetimes as dd/mm/aaaa às hh:mm — 24h, no meridiem', () => {
    expect(formatBahiaCivilDateTimeLabel('2026-08-07T14:30')).toBe('07/08/2026 às 14:30')
    expect(formatBahiaCivilDateTimeLabel('2026-08-07T09:45')).toBe('07/08/2026 às 09:45')
    expect(formatBahiaCivilDateTimeLabel('2026-08-07T23:05')).toBe('07/08/2026 às 23:05')
    expect(formatBahiaCivilDateTimeLabel('2026-08-07T00:00')).toBe('07/08/2026 às 00:00')
  })

  it('exposes 24 hours and the 15-min step grid', () => {
    expect(hourOptions).toHaveLength(24)
    expect(hourOptions[0]).toBe('00')
    expect(hourOptions[23]).toBe('23')
    expect(timeStepMinutes).toBe(15)
    expect(minuteOptionsForStep()).toEqual(['00', '15', '30', '45'])
    expect(minuteOptionsForStep(5)).toEqual([
      '00',
      '05',
      '10',
      '15',
      '20',
      '25',
      '30',
      '35',
      '40',
      '45',
      '50',
      '55',
    ])
  })

  it('floors minutes to the step, leaving the date and hour untouched', () => {
    expect(floorToMinuteStep('2026-08-07T14:47')).toBe('2026-08-07T14:45')
    expect(floorToMinuteStep('2026-08-07T14:00')).toBe('2026-08-07T14:00')
    expect(floorToMinuteStep('2026-08-07T14:59')).toBe('2026-08-07T14:45')
    expect(floorToMinuteStep('2026-08-07T14:07', 5)).toBe('2026-08-07T14:05')
  })

  it('passes malformed input through untouched', () => {
    expect(formatBahiaCivilDateTimeLabel('lixo')).toBe('lixo')
    expect(floorToMinuteStep('lixo')).toBe('lixo')
  })
})

describe('Bahia event date label (S29)', () => {
  it('labels the announcement headline in Bahia time, minutes only when needed', () => {
    expect(formatBahiaEventDateLabel('2026-10-03T22:00:00.000Z')).toBe('Sábado, 3 de outubro · 19h')
    expect(formatBahiaEventDateLabel('2026-10-03T22:30:00.000Z')).toBe(
      'Sábado, 3 de outubro · 19h30',
    )
  })

  it('returns an empty string for an unparsable instant', () => {
    expect(formatBahiaEventDateLabel('lixo')).toBe('')
  })
})
