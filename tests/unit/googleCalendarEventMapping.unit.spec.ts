import { describe, expect, it } from 'vitest'

import {
  buildGoogleCalendarDescription,
  buildGoogleEventPayload,
  decodeGoogleEventActivityId,
  googleEventContentEquals,
  googleEventIdForActivity,
  type GoogleRemoteEvent,
} from '@/lib/googleCalendarEventMapping'

type MappingSource = Parameters<typeof buildGoogleEventPayload>[0]

const baseActivity = (overrides: Partial<MappingSource> = {}): MappingSource =>
  ({
    id: 42,
    title: 'Caminhada no Cabula',
    startAt: '2026-08-15T19:00:00.000Z',
    endAt: '2026-08-15T22:00:00.000Z',
    allDay: false,
    locality: 'Centro',
    tags: ['Caminhada'],
    deputyPresent: true,
    ...overrides,
  }) as MappingSource

describe('googleEventIdForActivity / decodeGoogleEventActivityId', () => {
  it('encodes ids in base32hex under the teqo prefix (charset do Google)', () => {
    expect(googleEventIdForActivity(0)).toBe('teqo0')
    expect(googleEventIdForActivity(1)).toBe('teqo1')
    expect(googleEventIdForActivity(31)).toBe('teqov')
    expect(googleEventIdForActivity(32)).toBe('teqo10')
    expect(googleEventIdForActivity(1000)).toBe('teqov8')
  })

  it('round-trips any positive id', () => {
    for (const id of [1, 7, 42, 255, 1024, 123_456, 999_999_999]) {
      const encoded = googleEventIdForActivity(id)
      expect(encoded).toMatch(/^teqo[a-v0-9]+$/)
      expect(decodeGoogleEventActivityId(encoded)).toBe(id)
    }
  })

  it('rejects foreign and malformed ids', () => {
    expect(decodeGoogleEventActivityId('meu-evento-42')).toBeNull()
    expect(decodeGoogleEventActivityId('teqo')).toBeNull()
    expect(decodeGoogleEventActivityId('teqoz')).toBeNull()
    expect(decodeGoogleEventActivityId('teqoA1')).toBeNull()
  })

  it('rejects invalid activity ids', () => {
    expect(() => googleEventIdForActivity(-1)).toThrow()
    expect(() => googleEventIdForActivity(1.5)).toThrow()
  })
})

describe('buildGoogleEventPayload', () => {
  it('maps a timed activity to RFC3339 dateTimes with the fixed -03:00 offset', () => {
    const payload = buildGoogleEventPayload(baseActivity(), 'Salvador')

    expect(payload.id).toBe('teqo1a')
    expect(payload.summary).toBe('[Salvador] Caminhada no Cabula')
    expect(payload.start).toEqual({ dateTime: '2026-08-15T16:00:00-03:00' })
    expect(payload.end).toEqual({ dateTime: '2026-08-15T19:00:00-03:00' })
    expect(payload.location).toBe('Centro')
  })

  it('builds the description without unnecessary PII', () => {
    const payload = buildGoogleEventPayload(baseActivity(), 'Salvador')

    expect(payload.description).toContain('Município: Salvador')
    expect(payload.description).toContain('Local: Centro')
    expect(payload.description).toContain('Tags: Caminhada')
    expect(payload.description).toContain('Deputado presente')
  })

  it('synthesizes end = start + 1h when the activity has no endAt (Google exige end > start)', () => {
    const payload = buildGoogleEventPayload(
      baseActivity({ endAt: null, startAt: '2026-08-15T19:00:00.000Z' }),
      'Salvador',
    )

    expect(payload.start).toEqual({ dateTime: '2026-08-15T16:00:00-03:00' })
    expect(payload.end).toEqual({ dateTime: '2026-08-15T17:00:00-03:00' })
  })

  it('maps all-day activities to civil dates with the exclusive end (C104 convention)', () => {
    const payload = buildGoogleEventPayload(
      baseActivity({
        allDay: true,
        startAt: '2026-08-10T03:00:00.000Z',
        endAt: '2026-08-12T03:00:00.000Z',
        locality: '',
      }),
      'Feira de Santana',
    )

    expect(payload.start).toEqual({ date: '2026-08-10' })
    expect(payload.end).toEqual({ date: '2026-08-13' })
  })

  it('falls back to the municipality name as the location when locality is empty', () => {
    const payload = buildGoogleEventPayload(baseActivity({ locality: '' }), 'Salvador')
    expect(payload.location).toBe('Salvador')
  })

  it('omits location entirely when neither locality nor municipality name exist', () => {
    const payload = buildGoogleEventPayload(baseActivity({ locality: '' }))
    expect(payload.location).toBeUndefined()
    expect(payload.summary).toBe('Caminhada no Cabula')
  })
})

describe('buildGoogleCalendarDescription', () => {
  it('is empty when there is nothing to say', () => {
    expect(buildGoogleCalendarDescription({ locality: '', tags: [], deputyPresent: false })).toBe(
      '',
    )
  })
})

describe('googleEventContentEquals', () => {
  const payload = buildGoogleEventPayload(baseActivity(), 'Salvador')

  it('treats the same instant under a different timezone echo as equal', () => {
    const remote: GoogleRemoteEvent = {
      id: payload.id,
      summary: payload.summary,
      description: payload.description,
      location: payload.location,
      // Calendar in America/Sao_Paulo echoes the same instant with its own offset.
      start: { dateTime: '2026-08-15T16:00:00-03:00', timeZone: 'America/Sao_Paulo' },
      end: { dateTime: '2026-08-15T19:00:00-03:00', timeZone: 'America/Sao_Paulo' },
    }
    expect(googleEventContentEquals(remote, payload)).toBe(true)
  })

  it('flags content drift', () => {
    const remote: GoogleRemoteEvent = { ...payload, summary: '[Salvador] Outro título' }
    expect(googleEventContentEquals(remote, payload)).toBe(false)
  })

  it('flags a moved instant', () => {
    const remote: GoogleRemoteEvent = {
      ...payload,
      start: { dateTime: '2026-08-16T16:00:00-03:00' },
      end: { dateTime: '2026-08-16T19:00:00-03:00' },
    }
    expect(googleEventContentEquals(remote, payload)).toBe(false)
  })

  it('compares all-day events by civil date', () => {
    const allDayPayload = buildGoogleEventPayload(
      baseActivity({
        allDay: true,
        startAt: '2026-08-10T03:00:00.000Z',
        endAt: '2026-08-12T03:00:00.000Z',
      }),
      'Feira de Santana',
    )
    const remote: GoogleRemoteEvent = {
      id: allDayPayload.id,
      summary: allDayPayload.summary,
      description: allDayPayload.description,
      location: allDayPayload.location,
      start: { date: '2026-08-10' },
      end: { date: '2026-08-13' },
    }
    expect(googleEventContentEquals(remote, allDayPayload)).toBe(true)
  })

  it('treats a missing remote description as empty (not drift)', () => {
    const remote: GoogleRemoteEvent = {
      id: payload.id,
      summary: payload.summary,
      start: payload.start,
      end: payload.end,
    }
    expect(
      googleEventContentEquals(remote, { ...payload, description: '', location: undefined }),
    ).toBe(true)
  })
})
