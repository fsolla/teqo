import { describe, expect, it } from 'vitest'

import {
  buildGoogleReverseCancelBody,
  buildGoogleReverseUpdateBody,
  GOOGLE_REVERSE_EDIT_BODY_PREFIX,
  googleEditIsNewer,
  googleScheduleToActivityFields,
  googleTitleFromSummary,
} from '@/lib/googleCalendarReverseEdit'

const MUNICIPALITY = 'Salvador'

describe('googleEditIsNewer (C115 clock rule)', () => {
  it('wins only when the Google updated instant is newer than the tolerance', () => {
    const local = '2026-08-11T12:00:00.000Z'
    expect(googleEditIsNewer('2026-08-11T12:00:02.500Z', local)).toBe(true)
    expect(googleEditIsNewer('2026-08-11T12:00:01.500Z', local)).toBe(false)
    expect(googleEditIsNewer('2026-08-11T12:00:00.000Z', local)).toBe(false)
    expect(googleEditIsNewer('2026-08-10T12:00:00.000Z', local)).toBe(false)
  })

  it('fails closed on missing or unparseable timestamps', () => {
    expect(googleEditIsNewer(undefined, '2026-08-11T12:00:00.000Z')).toBe(false)
    expect(googleEditIsNewer('not-a-date', '2026-08-11T12:00:00.000Z')).toBe(false)
    expect(googleEditIsNewer('2026-08-11T12:00:01.000Z', undefined)).toBe(false)
  })
})

describe('googleTitleFromSummary (C115 prefix strip)', () => {
  it('strips only our own [Município] prefix', () => {
    expect(googleTitleFromSummary('[Salvador] Caminhada no Centro', MUNICIPALITY)).toBe(
      'Caminhada no Centro',
    )
  })

  it('keeps a summary without our prefix verbatim (user-owned title)', () => {
    expect(googleTitleFromSummary('Reunião com o prefeito', MUNICIPALITY)).toBe(
      'Reunião com o prefeito',
    )
  })

  it('keeps a foreign prefix verbatim — it is user text, not ours', () => {
    expect(googleTitleFromSummary('[URGENTE] Reunião', MUNICIPALITY)).toBe('[URGENTE] Reunião')
  })

  it('a summary that is only the prefix is structural tampering → null', () => {
    expect(googleTitleFromSummary('[Salvador]', MUNICIPALITY)).toBeNull()
    expect(googleTitleFromSummary('[Salvador]   ', MUNICIPALITY)).toBeNull()
  })

  it('empty summaries are null', () => {
    expect(googleTitleFromSummary(undefined, MUNICIPALITY)).toBeNull()
    expect(googleTitleFromSummary('   ', MUNICIPALITY)).toBeNull()
  })

  it('caps the title at the Activity field limit (160)', () => {
    const long = 'x'.repeat(200)
    expect(googleTitleFromSummary(long, MUNICIPALITY)).toHaveLength(160)
  })
})

describe('googleScheduleToActivityFields (C115 reverse schedule)', () => {
  it('maps a timed event by absolute instant', () => {
    const fields = googleScheduleToActivityFields({
      start: { dateTime: '2026-08-14T10:00:00-03:00' },
      end: { dateTime: '2026-08-14T12:30:00-03:00' },
    })
    expect(fields).toEqual({
      startAt: '2026-08-14T13:00:00.000Z',
      endAt: '2026-08-14T15:30:00.000Z',
      allDay: false,
    })
  })

  it('maps a single-day all-day event to day-boundary instants', () => {
    const fields = googleScheduleToActivityFields({
      start: { date: '2026-08-14' },
      end: { date: '2026-08-15' },
    })
    expect(fields).toEqual({
      startAt: '2026-08-14T03:00:00.000Z',
      endAt: '2026-08-14T03:00:00.000Z',
      allDay: true,
    })
  })

  it('maps a multi-day all-day range (exclusive end → inclusive last day)', () => {
    const fields = googleScheduleToActivityFields({
      start: { date: '2026-08-14' },
      end: { date: '2026-08-17' },
    })
    expect(fields).toEqual({
      startAt: '2026-08-14T03:00:00.000Z',
      endAt: '2026-08-16T03:00:00.000Z',
      allDay: true,
    })
  })

  it('fails closed on malformed values — the Teqo keeps its state', () => {
    expect(googleScheduleToActivityFields({ start: undefined, end: undefined })).toBeNull()
    expect(googleScheduleToActivityFields({ start: { dateTime: 'x' }, end: {} })).toBeNull()
    expect(
      googleScheduleToActivityFields({ start: { dateTime: '2026-08-14T10:00:00-03:00' } }),
    ).toBeNull()
    expect(
      googleScheduleToActivityFields({
        start: { date: '2026-13-99' },
        end: { date: '2026-08-15' },
      }),
    ).toBeNull()
    expect(
      googleScheduleToActivityFields({
        start: { date: '2026-08-15' },
        end: { date: '2026-08-15' },
      }),
    ).toBeNull()
  })
})

describe('buildGoogleReverseUpdateBody (C115 audit record)', () => {
  const previous = {
    title: 'Caminhada',
    startAt: '2026-08-14T13:00:00.000Z',
    endAt: '2026-08-14T14:00:00.000Z',
    allDay: false,
  }

  it('records a title change with the Google prefix', () => {
    const body = buildGoogleReverseUpdateBody(previous, { ...previous, title: 'Caminhada 2' })
    expect(body).toBe(`${GOOGLE_REVERSE_EDIT_BODY_PREFIX} título alterado para "Caminhada 2"`)
  })

  it('records a reschedule with before → after labels', () => {
    const body = buildGoogleReverseUpdateBody(previous, {
      ...previous,
      startAt: '2026-08-15T16:00:00.000Z',
      endAt: '2026-08-15T17:00:00.000Z',
    })
    expect(body).toBe(
      `${GOOGLE_REVERSE_EDIT_BODY_PREFIX} remarcada — antes 14/08/2026 às 10:00 — 14/08/2026 às 11:00, agora 15/08/2026 às 13:00 — 15/08/2026 às 14:00`,
    )
  })

  it('records an all-day range change', () => {
    const body = buildGoogleReverseUpdateBody(
      {
        title: 'X',
        startAt: '2026-08-14T03:00:00.000Z',
        endAt: '2026-08-14T03:00:00.000Z',
        allDay: true,
      },
      {
        title: 'X',
        startAt: '2026-08-20T03:00:00.000Z',
        endAt: '2026-08-22T03:00:00.000Z',
        allDay: true,
      },
    )
    expect(body).toBe(
      `${GOOGLE_REVERSE_EDIT_BODY_PREFIX} remarcada — antes 14/08/2026, agora 20/08/2026 a 22/08/2026`,
    )
  })

  it('combines title and schedule changes', () => {
    const body = buildGoogleReverseUpdateBody(previous, {
      title: 'Novo',
      startAt: '2026-08-15T16:00:00.000Z',
      endAt: null,
      allDay: false,
    })
    expect(body).toContain('título alterado para "Novo"')
    expect(body).toContain('remarcada')
  })

  it('falls back to a generic line when nothing changed', () => {
    const body = buildGoogleReverseUpdateBody(previous, previous)
    expect(body).toBe(`${GOOGLE_REVERSE_EDIT_BODY_PREFIX} compromisso atualizado`)
  })

  it('the cancellation record carries the same prefix', () => {
    expect(buildGoogleReverseCancelBody()).toBe(`${GOOGLE_REVERSE_EDIT_BODY_PREFIX} cancelada`)
  })
})
