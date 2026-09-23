import { describe, expect, it } from 'vitest'

import { buildCalendarEventIcs } from '@/lib/calendarEvent'
import { foldICalLine } from '@/lib/ical'
import { generateICalFeed } from '@/utilities/calendarFeed'

const encoder = new TextEncoder()

const octets = (value: string): number => encoder.encode(value).length

/** RFC 5545 unfold: a CRLF followed by a single space is a fold, not a line break. */
const unfold = (value: string): string => value.replace(/\r\n /g, '')

const physicalLines = (value: string): string[] => value.split('\r\n')

const expectAllPhysicalLinesWithin75Octets = (value: string): void => {
  for (const [index, line] of physicalLines(value).entries()) {
    expect(octets(line), `physical line ${index}: ${line}`).toBeLessThanOrEqual(75)
  }
}

describe('foldICalLine', () => {
  it('returns lines of up to 75 octets untouched', () => {
    const short = 'SUMMARY:Comício em Salvador'
    expect(foldICalLine(short)).toBe(short)

    const exact = `SUMMARY:${'a'.repeat(67)}`
    expect(octets(exact)).toBe(75)
    expect(foldICalLine(exact)).toBe(exact)
  })

  it('folds a 76-octet line at the boundary with a one-space continuation', () => {
    const over = `SUMMARY:${'a'.repeat(68)}`
    expect(octets(over)).toBe(76)

    const folded = foldICalLine(over)
    const lines = physicalLines(folded)

    expect(lines).toEqual([`SUMMARY:${'a'.repeat(67)}`, ' a'])
    expect(unfold(folded)).toBe(over)
  })

  it('folds long ASCII lines into physical lines of at most 75 octets', () => {
    const line = `DESCRIPTION:${'x'.repeat(160)}`
    const folded = foldICalLine(line)
    const lines = physicalLines(folded)

    expect(lines.length).toBeGreaterThan(1)
    expectAllPhysicalLinesWithin75Octets(folded)
    expect(octets(lines[0])).toBe(75)
    expect(octets(lines[1])).toBe(75)
    expect(lines.slice(1).every((part) => part.startsWith(' '))).toBe(true)
    expect(unfold(folded)).toBe(line)
  })

  it('never splits a multi-byte character across physical lines', () => {
    const line = `DESCRIPTION:${'Comício '.repeat(20)}`
    const folded = foldICalLine(line)

    expect(physicalLines(folded).length).toBeGreaterThan(1)
    expectAllPhysicalLinesWithin75Octets(folded)
    expect(folded).not.toContain('\uFFFD')
    expect(unfold(folded)).toBe(line)
  })

  it('backs off to the last whole character when the boundary falls mid-character', () => {
    const line = `DESCRIPTION:${'á'.repeat(40)}`
    const folded = foldICalLine(line)
    const [first] = physicalLines(folded)

    expect(octets(first)).toBeLessThanOrEqual(75)
    expect(first.endsWith('á')).toBe(true)
    expect(folded).not.toContain('\uFFFD')
    expect(unfold(folded)).toBe(line)
  })

  it('backs off on a continuation line whose payload does not fit whole characters', () => {
    // 74 continuation octets hold 24 three-octet characters (72) — the 25th
    // would cross the limit, so the chunk must close at 72, not 74.
    const line = `DESCRIPTION:${'中'.repeat(60)}`
    const folded = foldICalLine(line)
    const lines = physicalLines(folded)

    expectAllPhysicalLinesWithin75Octets(folded)
    expect(octets(lines[0])).toBe(75)
    expect(octets(lines[1])).toBe(73)
    expect(folded).not.toContain('\uFFFD')
    expect(unfold(folded)).toBe(line)
  })
})

describe('folded .ics builders', () => {
  const STARTS_AT = '2026-10-03T22:00:00.000Z'
  const ENDS_AT = '2026-10-04T00:00:00.000Z'
  const LONG_DESCRIPTION = 'Encontro da campanha com a militância. '.repeat(6)

  it('buildCalendarEventIcs folds a long DESCRIPTION and preserves the logical content', () => {
    const body = buildCalendarEventIcs({
      uid: 'plenaria@teqo.jorgesolla.com.br',
      title: 'Plenária da saúde',
      description: LONG_DESCRIPTION,
      location: 'Online',
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
      updatedAt: '2026-09-23T12:00:00.000Z',
    }) as string

    expectAllPhysicalLinesWithin75Octets(body)
    expect(unfold(body)).toContain(`DESCRIPTION:${LONG_DESCRIPTION}`)
    expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(body.endsWith('END:VCALENDAR')).toBe(true)
  })

  it('generateICalFeed folds a long activity DESCRIPTION and preserves the logical content', () => {
    const locality = 'Centro histórico, ao lado do elevador Lacerda e do mercado modelo '.repeat(3)
    const activities = [
      {
        id: 1,
        slug: 'comicio-salvador',
        title: 'Comício em Salvador',
        status: 'confirmado' as const,
        startAt: '2026-08-15T19:00:00.000Z',
        endAt: '2026-08-15T22:00:00.000Z',
        municipality: 1,
        locality,
        tags: ['comício', 'campanha'],
        deputyPresent: true,
        updatedAt: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ] as unknown as Parameters<typeof generateICalFeed>[0]

    const body = generateICalFeed(activities, 'Agenda do Candidato', new Map([[1, 'Salvador']]))

    expectAllPhysicalLinesWithin75Octets(body)
    expect(unfold(body)).toContain(`Local: ${locality}`)
    expect(body).toContain('BEGIN:VCALENDAR\r\n')
    expect(body).toContain('UID:comicio-salvador@teqo.jorgesolla.com.br\r\n')
    expect(body).toContain('SUMMARY:[Salvador] Comício em Salvador\r\n')
  })
})
