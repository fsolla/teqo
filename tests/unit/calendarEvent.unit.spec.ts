import { describe, expect, it } from 'vitest'

import {
  buildCalendarEventIcs,
  buildGoogleCalendarEventUrl,
  DEFAULT_EVENT_DURATION_MS,
  resolveCalendarEventWindow,
} from '@/lib/calendarEvent'

const STARTS_AT = '2026-10-03T22:00:00.000Z'
const ENDS_AT = '2026-10-04T00:00:00.000Z'

describe('resolveCalendarEventWindow', () => {
  it('returns null without a start, so the calendar options hide', () => {
    expect(resolveCalendarEventWindow(null, ENDS_AT)).toBeNull()
    expect(resolveCalendarEventWindow('', ENDS_AT)).toBeNull()
    expect(resolveCalendarEventWindow('lixo', ENDS_AT)).toBeNull()
  })

  it('falls back to the 2-hour default without an end', () => {
    const window = resolveCalendarEventWindow(STARTS_AT, null)
    expect(window?.end.getTime()).toBe(new Date(STARTS_AT).getTime() + DEFAULT_EVENT_DURATION_MS)
  })

  it('falls back when the end is invalid or does not move forward', () => {
    const startMs = new Date(STARTS_AT).getTime()
    expect(resolveCalendarEventWindow(STARTS_AT, 'lixo')?.end.getTime()).toBe(
      startMs + DEFAULT_EVENT_DURATION_MS,
    )
    expect(resolveCalendarEventWindow(STARTS_AT, STARTS_AT)?.end.getTime()).toBe(
      startMs + DEFAULT_EVENT_DURATION_MS,
    )
    expect(resolveCalendarEventWindow(STARTS_AT, '2026-10-03T21:00:00.000Z')?.end.getTime()).toBe(
      startMs + DEFAULT_EVENT_DURATION_MS,
    )
  })

  it('keeps an explicit end that moves forward', () => {
    expect(resolveCalendarEventWindow(STARTS_AT, ENDS_AT)?.end.toISOString()).toBe(ENDS_AT)
  })
})

describe('buildGoogleCalendarEventUrl', () => {
  it('builds an action=TEMPLATE URL with UTC dates, details and location', () => {
    const url = buildGoogleCalendarEventUrl({
      title: 'Plenária da saúde',
      description: 'Encontro online da campanha.',
      location: 'Online',
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
    })
    expect(url).not.toBeNull()

    const parsed = new URL(url as string)
    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://calendar.google.com/calendar/render')
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE')
    expect(parsed.searchParams.get('text')).toBe('Plenária da saúde')
    expect(parsed.searchParams.get('dates')).toBe('20261003T220000Z/20261004T000000Z')
    expect(parsed.searchParams.get('details')).toBe('Encontro online da campanha.')
    expect(parsed.searchParams.get('location')).toBe('Online')
  })

  it('uses the 2-hour default when the end is missing', () => {
    const url = buildGoogleCalendarEventUrl({ title: 'Plenária', startsAt: STARTS_AT })
    const parsed = new URL(url as string)
    expect(parsed.searchParams.get('dates')).toBe('20261003T220000Z/20261004T000000Z')
    expect(parsed.searchParams.get('details')).toBeNull()
    expect(parsed.searchParams.get('location')).toBeNull()
  })

  it('returns null without a valid start', () => {
    expect(buildGoogleCalendarEventUrl({ title: 'Plenária' })).toBeNull()
    expect(buildGoogleCalendarEventUrl({ title: 'Plenária', startsAt: 'lixo' })).toBeNull()
  })
})

describe('buildCalendarEventIcs', () => {
  it('builds a single VEVENT with CRLF and escaped fields', () => {
    const ics = buildCalendarEventIcs({
      uid: 'plenaria@teqo.jorgesolla.com.br',
      title: 'Plenária, saúde',
      description: 'Linha 1\nLinha 2',
      location: 'Online; sala 1',
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
      updatedAt: '2026-09-23T12:00:00.000Z',
    })
    expect(ics).not.toBeNull()

    const body = ics as string
    expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(body.endsWith('END:VCALENDAR')).toBe(true)
    expect(body).toContain('UID:plenaria@teqo.jorgesolla.com.br\r\n')
    expect(body).toContain('DTSTAMP:20260923T120000Z\r\n')
    expect(body).toContain('DTSTART:20261003T220000Z\r\n')
    expect(body).toContain('DTEND:20261004T000000Z\r\n')
    expect(body).toContain('SUMMARY:Plenária\\, saúde\r\n')
    expect(body).toContain('DESCRIPTION:Linha 1\\nLinha 2\r\n')
    expect(body).toContain('LOCATION:Online\\; sala 1\r\n')
  })

  it('omits optional lines and falls back to the start for DTSTAMP', () => {
    const body = buildCalendarEventIcs({
      uid: 'x@teqo.jorgesolla.com.br',
      title: 'Plenária',
      startsAt: STARTS_AT,
      updatedAt: 'lixo',
    }) as string

    expect(body).toContain('DTSTAMP:20261003T220000Z\r\n')
    expect(body).not.toContain('DESCRIPTION:')
    expect(body).not.toContain('LOCATION:')
  })

  it('returns null without a valid start — never an empty file', () => {
    expect(buildCalendarEventIcs({ uid: 'x@teqo', title: 'Plenária' })).toBeNull()
    expect(buildCalendarEventIcs({ uid: 'x@teqo', title: 'Plenária', startsAt: 'lixo' })).toBeNull()
  })
})
