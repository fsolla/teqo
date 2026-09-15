import { describe, expect, it } from 'vitest'

import {
  buildGoogleCalendarDescription,
  buildGoogleEventPayload,
  buildImportedGoogleEventActivity,
  buildImportedGoogleEventPatch,
  decodeGoogleEventActivityId,
  googleEventContentEquals,
  googleEventIdForActivity,
  googleImportedEventContentEquals,
  isForeignGoogleEvent,
  isImportableGoogleEvent,
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

describe('isForeignGoogleEvent (C165)', () => {
  it('accepts only ids the mirror does not own (full decode, never a prefix)', () => {
    expect(isForeignGoogleEvent({ id: 'abc123' })).toBe(true)
    // `teqo` (the bare prefix) does not decode to an activity — foreign.
    expect(decodeGoogleEventActivityId('teqo')).toBeNull()
    expect(isForeignGoogleEvent({ id: 'teqo' })).toBe(true)
    expect(isForeignGoogleEvent({ id: 'teqo3' })).toBe(false)
    // A manual `teqo3` decodes to activity 3: it stays in the mirror
    // namespace and is never imported.
    expect(decodeGoogleEventActivityId('teqo3')).toBe(3)
    expect(isForeignGoogleEvent({})).toBe(false)
  })
})

describe('isImportableGoogleEvent (C165 cut + window)', () => {
  const window = { rangeStart: '2026-07-01T00:00:00.000Z', rangeEnd: '2027-09-01T00:00:00.000Z' }
  const timed = (startAt: string): GoogleRemoteEvent => ({
    id: 'foreign-1',
    summary: 'Reunião',
    start: { dateTime: startAt },
    end: { dateTime: new Date(Date.parse(startAt) + 3_600_000).toISOString() },
  })

  it('applies the cut on the Bahia civil date: 15/08 out, 16/08 in', () => {
    expect(isImportableGoogleEvent(timed('2026-08-16T02:59:00.000Z'), window)).toBe(false)
    expect(isImportableGoogleEvent(timed('2026-08-16T03:00:00.000Z'), window)).toBe(true)
    expect(
      isImportableGoogleEvent(
        {
          id: 'foreign-2',
          summary: 'Aniversário',
          start: { date: '2026-08-15' },
          end: { date: '2026-08-16' },
        },
        window,
      ),
    ).toBe(false)
    expect(
      isImportableGoogleEvent(
        {
          id: 'foreign-3',
          summary: 'Caminhada',
          start: { date: '2026-08-16' },
          end: { date: '2026-08-17' },
        },
        window,
      ),
    ).toBe(true)
  })

  it('respects the mirror window on both ends', () => {
    expect(isImportableGoogleEvent(timed('2027-09-02T12:00:00.000Z'), window)).toBe(false)
    expect(
      isImportableGoogleEvent(timed('2026-06-30T12:00:00.000Z'), {
        rangeStart: '2026-08-16T03:00:00.000Z',
        rangeEnd: '2027-09-01T00:00:00.000Z',
      }),
    ).toBe(false)
  })

  it('rejects cancelled, mirrored and malformed events', () => {
    expect(
      isImportableGoogleEvent(
        { ...timed('2026-08-20T12:00:00.000Z'), status: 'cancelled' },
        window,
      ),
    ).toBe(false)
    expect(isImportableGoogleEvent({ id: 'foreign-4', summary: 'Sem data' }, window)).toBe(false)
    expect(
      isImportableGoogleEvent(
        { id: 'foreign-5', summary: 'Sem fim', start: { dateTime: '2026-08-20T12:00:00.000Z' } },
        window,
      ),
    ).toBe(false)
    // A `teqo…` id belongs to the mirror namespace, never to the import pass.
    expect(
      isImportableGoogleEvent({ ...timed('2026-08-20T12:00:00.000Z'), id: 'teqo3' }, window),
    ).toBe(false)
  })
})

describe('buildImportedGoogleEventActivity (C165)', () => {
  const calendarId = 'c_imprensa@group.calendar.google.com'

  it('shapes a timed event: title verbatim, location as locality, description ignored', () => {
    const data = buildImportedGoogleEventActivity(
      {
        id: 'foreign-1',
        summary: 'Reunião com o prefeito',
        description: 'pauta longa que fica no Google',
        location: 'Gabinete',
        start: { dateTime: '2026-08-20T12:00:00-03:00' },
        end: { dateTime: '2026-08-20T13:00:00-03:00' },
      },
      calendarId,
    )

    expect(data).toMatchObject({
      title: 'Reunião com o prefeito',
      status: 'confirmado',
      startAt: '2026-08-20T15:00:00.000Z',
      endAt: '2026-08-20T16:00:00.000Z',
      allDay: false,
      locality: 'Gabinete',
      googleEventId: 'foreign-1',
      googleCalendarId: calendarId,
      tags: [],
    })
    expect(data && 'description' in data).toBe(false)
  })

  it('keeps a `[X] ` prefix of a foreign summary verbatim (no municipality to strip)', () => {
    const data = buildImportedGoogleEventActivity(
      {
        id: 'foreign-2',
        summary: '[URGENTE] Reunião',
        start: { dateTime: '2026-08-20T12:00:00-03:00' },
        end: { dateTime: '2026-08-20T13:00:00-03:00' },
      },
      calendarId,
    )
    expect(data?.title).toBe('[URGENTE] Reunião')
  })

  it('maps all-day events through the C104 civil-date convention', () => {
    const data = buildImportedGoogleEventActivity(
      {
        id: 'foreign-3',
        summary: 'Feriado',
        start: { date: '2026-08-20' },
        end: { date: '2026-08-22' },
      },
      calendarId,
    )
    expect(data).toMatchObject({
      allDay: true,
      startAt: '2026-08-20T03:00:00.000Z',
      endAt: '2026-08-21T03:00:00.000Z',
    })
  })

  it('skips events without a usable title or schedule (never pauses the pass)', () => {
    const schedule = {
      start: { dateTime: '2026-08-20T12:00:00-03:00' },
      end: { dateTime: '2026-08-20T13:00:00-03:00' },
    }
    expect(buildImportedGoogleEventActivity({ id: 'f', ...schedule }, calendarId)).toBeNull()
    expect(
      buildImportedGoogleEventActivity({ id: 'f', summary: 'A', ...schedule }, calendarId),
    ).toBeNull()
    expect(
      buildImportedGoogleEventActivity({ id: 'f', summary: '💡', ...schedule }, calendarId),
    ).toBeNull()
    expect(
      buildImportedGoogleEventActivity({ summary: 'Sem id', ...schedule }, calendarId),
    ).toBeNull()
    expect(
      buildImportedGoogleEventActivity(
        { id: 'f', summary: 'Sem data', description: 'x' },
        calendarId,
      ),
    ).toBeNull()
  })

  it('builds a deterministic slug unique per event (recurrence + duplicate titles)', () => {
    const first = buildImportedGoogleEventActivity(
      {
        id: 'master_20260816T120000Z',
        summary: 'Reunião',
        start: { dateTime: '2026-08-16T12:00:00-03:00' },
        end: { dateTime: '2026-08-16T13:00:00-03:00' },
      },
      calendarId,
    )
    const second = buildImportedGoogleEventActivity(
      {
        id: 'master_20260817T120000Z',
        summary: 'Reunião',
        start: { dateTime: '2026-08-17T12:00:00-03:00' },
        end: { dateTime: '2026-08-17T13:00:00-03:00' },
      },
      calendarId,
    )
    const duplicate = buildImportedGoogleEventActivity(
      {
        id: 'outro-evento',
        summary: 'Reunião',
        start: { dateTime: '2026-08-16T12:00:00-03:00' },
        end: { dateTime: '2026-08-16T13:00:00-03:00' },
      },
      calendarId,
    )

    expect(first?.slug).toMatch(/^reuniao-20260816T1200-[a-z0-9]+$/)
    expect(first?.slug).not.toBe(second?.slug)
    expect(first?.slug).not.toBe(duplicate?.slug)
  })
})

describe('buildImportedGoogleEventPatch / googleImportedEventContentEquals (C165)', () => {
  const activity = {
    title: 'Reunião com o prefeito',
    startAt: '2026-08-20T15:00:00.000Z',
    endAt: '2026-08-20T16:00:00.000Z',
    allDay: false,
    locality: 'Gabinete',
  }

  it('patches only the fields the Teqo owns: no description, no id, verbatim summary', () => {
    expect(buildImportedGoogleEventPatch(activity)).toEqual({
      summary: 'Reunião com o prefeito',
      location: 'Gabinete',
      start: { dateTime: '2026-08-20T12:00:00-03:00' },
      end: { dateTime: '2026-08-20T13:00:00-03:00' },
    })
    expect(buildImportedGoogleEventPatch({ ...activity, locality: '' }).location).toBe('')
  })

  it('compares summary + schedule + location and IGNORES the Google description', () => {
    const patch = buildImportedGoogleEventPatch(activity)
    const remote: GoogleRemoteEvent = {
      id: 'foreign-1',
      summary: patch.summary,
      description: 'texto que só existe no Google',
      location: patch.location,
      start: patch.start,
      end: patch.end,
    }
    expect(googleImportedEventContentEquals(remote, patch)).toBe(true)

    expect(googleImportedEventContentEquals({ ...remote, summary: 'Outro' }, patch)).toBe(false)
    expect(googleImportedEventContentEquals({ ...remote, location: 'Outro' }, patch)).toBe(false)
    expect(
      googleImportedEventContentEquals(
        { ...remote, start: { dateTime: '2026-08-21T12:00:00-03:00' } },
        patch,
      ),
    ).toBe(false)
  })
})
