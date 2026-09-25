import { describe, expect, it } from 'vitest'

import {
  buildCalendarEventIcs,
  buildGoogleCalendarEventUrl,
  DEFAULT_EVENT_DURATION_MS,
  resolveCalendarEventWindow,
} from '@/lib/calendarEvent'

const STARTS_AT = '2026-10-03T22:00:00.000Z'
const ENDS_AT = '2026-10-04T00:00:00.000Z'
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

describe('resolveCalendarEventWindow', () => {
  it('returns null without a start, so the calendar options hide', () => {
    expect(resolveCalendarEventWindow(null, ENDS_AT)).toBeNull()
    expect(resolveCalendarEventWindow('', ENDS_AT)).toBeNull()
    expect(resolveCalendarEventWindow('lixo', ENDS_AT)).toBeNull()
  })

  it('falls back to the 2-hour default without an end', () => {
    expect(DEFAULT_EVENT_DURATION_MS).toBe(TWO_HOURS_MS)
    const window = resolveCalendarEventWindow(STARTS_AT, null)
    expect(window?.end.getTime()).toBe(new Date(STARTS_AT).getTime() + TWO_HOURS_MS)
  })

  it('falls back when the end is invalid or does not move forward', () => {
    const startMs = new Date(STARTS_AT).getTime()
    expect(resolveCalendarEventWindow(STARTS_AT, 'lixo')?.end.getTime()).toBe(
      startMs + TWO_HOURS_MS,
    )
    expect(resolveCalendarEventWindow(STARTS_AT, STARTS_AT)?.end.getTime()).toBe(
      startMs + TWO_HOURS_MS,
    )
    expect(resolveCalendarEventWindow(STARTS_AT, '2026-10-03T21:00:00.000Z')?.end.getTime()).toBe(
      startMs + TWO_HOURS_MS,
    )
  })

  it('keeps an explicit end that moves forward', () => {
    expect(resolveCalendarEventWindow(STARTS_AT, ENDS_AT)?.end.toISOString()).toBe(ENDS_AT)
  })
})

describe('buildGoogleCalendarEventUrl', () => {
  it('builds an action=TEMPLATE URL with Bahia dates, details, canonical link and location', () => {
    const url = buildGoogleCalendarEventUrl({
      title: 'Plenária da saúde',
      description: 'Encontro online da campanha.',
      location: 'Online',
      url: 'https://jorgesolla1313.com.br/plenaria-saude',
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
    })
    expect(url).not.toBeNull()

    const parsed = new URL(url as string)
    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://calendar.google.com/calendar/render')
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE')
    expect(parsed.searchParams.get('text')).toBe('Plenária da saúde - Jorge Solla 1313')
    expect(parsed.searchParams.get('dates')).toBe('20261003T190000/20261003T210000')
    expect(parsed.searchParams.get('ctz')).toBe('America/Bahia')
    expect(parsed.searchParams.get('details')).toBe(
      'Encontro online da campanha.\n\nPágina do evento: https://jorgesolla1313.com.br/plenaria-saude',
    )
    expect(parsed.searchParams.get('location')).toBe('Online')
  })

  it('does not duplicate the signature or emit a relative link', () => {
    const url = buildGoogleCalendarEventUrl({
      title: 'Plenária - Jorge Solla 1313',
      url: '/plenaria-saude',
      startsAt: STARTS_AT,
    })
    const parsed = new URL(url as string)
    expect(parsed.searchParams.get('text')).toBe('Plenária - Jorge Solla 1313')
    expect(parsed.searchParams.get('details')).toBeNull()
  })

  it('uses the canonical link alone when the configured description is empty', () => {
    const url = buildGoogleCalendarEventUrl({
      title: 'Plenária',
      description: '   ',
      url: 'https://jorgesolla1313.com.br/plenaria',
      startsAt: STARTS_AT,
    })
    expect(new URL(url as string).searchParams.get('details')).toBe(
      'Página do evento: https://jorgesolla1313.com.br/plenaria',
    )
  })

  it('uses the 2-hour default when the end is missing', () => {
    const url = buildGoogleCalendarEventUrl({ title: 'Plenária', startsAt: STARTS_AT })
    const parsed = new URL(url as string)
    expect(parsed.searchParams.get('dates')).toBe('20261003T190000/20261003T210000')
    expect(parsed.searchParams.get('details')).toBeNull()
    expect(parsed.searchParams.get('location')).toBeNull()
  })

  it('returns null without a valid start', () => {
    expect(buildGoogleCalendarEventUrl({ title: 'Plenária' })).toBeNull()
    expect(buildGoogleCalendarEventUrl({ title: 'Plenária', startsAt: 'lixo' })).toBeNull()
  })
})

describe('buildCalendarEventIcs', () => {
  it('builds a single VEVENT with Bahia timezone, canonical URL and escaped fields', () => {
    const ics = buildCalendarEventIcs({
      uid: 'plenaria@teqo.jorgesolla.com.br',
      title: 'Plenária, saúde',
      description: 'Linha 1\nLinha 2',
      location: 'Online; sala 1',
      url: 'https://jorgesolla1313.com.br/plenaria-saude',
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
    expect(body).toContain('BEGIN:VTIMEZONE\r\n')
    expect(body).toContain('TZID:America/Bahia\r\n')
    expect(body).toContain('TZOFFSETFROM:-0300\r\n')
    expect(body).toContain('TZOFFSETTO:-0300\r\n')
    expect(body).toContain('DTSTART;TZID=America/Bahia:20261003T190000\r\n')
    expect(body).toContain('DTEND;TZID=America/Bahia:20261003T210000\r\n')
    expect(body).toContain('SUMMARY:Plenária\\, saúde - Jorge Solla 1313\r\n')
    expect(body.replace(/\r\n /g, '')).toContain(
      'DESCRIPTION:Linha 1\\nLinha 2\\n\\nPágina do evento: https://jorgesolla1313.com.br/plenaria-saude\r\n',
    )
    expect(body).toContain('URL:https://jorgesolla1313.com.br/plenaria-saude\r\n')
    expect(body).toContain('LOCATION:Online\\; sala 1\r\n')
  })

  it('omits optional lines and falls back to the start for DTSTAMP without a canonical URL', () => {
    const body = buildCalendarEventIcs({
      uid: 'x@teqo.jorgesolla.com.br',
      title: 'Plenária',
      startsAt: STARTS_AT,
      updatedAt: 'lixo',
    }) as string

    expect(body).toContain('DTSTAMP:20261003T220000Z\r\n')
    expect(body).toContain('DTSTART;TZID=America/Bahia:20261003T190000\r\n')
    expect(body).toContain('SUMMARY:Plenária - Jorge Solla 1313\r\n')
    expect(body).not.toContain('DESCRIPTION:')
    expect(body).not.toContain('URL:')
    expect(body).not.toMatch(/(?:^|\r\n)LOCATION:/)
  })

  it('uses the canonical link alone when the configured description is empty', () => {
    const body = buildCalendarEventIcs({
      uid: 'x@teqo.jorgesolla.com.br',
      title: 'Plenária',
      description: '',
      url: 'https://jorgesolla1313.com.br/plenaria',
      startsAt: STARTS_AT,
    }) as string

    expect(body.replace(/\r\n /g, '')).toContain(
      'DESCRIPTION:Página do evento: https://jorgesolla1313.com.br/plenaria\r\n',
    )
  })

  it('omits a relative or invalid event URL', () => {
    const body = buildCalendarEventIcs({
      uid: 'x@teqo.jorgesolla.com.br',
      title: 'Plenária',
      url: '/evento',
      startsAt: STARTS_AT,
    }) as string

    expect(body).not.toContain('URL:')
    expect(body).not.toContain('Página do evento')

    const controlBody = buildCalendarEventIcs({
      uid: 'x@teqo.jorgesolla.com.br',
      title: 'Plenária',
      url: 'https://jorgesolla1313.com.br/evento\nX-Injected: yes',
      startsAt: STARTS_AT,
    }) as string
    expect(controlBody).not.toContain('URL:')
    expect(controlBody).not.toContain('Página do evento')
  })

  it('returns null without a valid start — never an empty file', () => {
    expect(buildCalendarEventIcs({ uid: 'x@teqo', title: 'Plenária' })).toBeNull()
    expect(buildCalendarEventIcs({ uid: 'x@teqo', title: 'Plenária', startsAt: 'lixo' })).toBeNull()
  })
})
