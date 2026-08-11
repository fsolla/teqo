import { describe, expect, it } from 'vitest'

import { buildICalFeedResponse, generateICalFeed } from '@/utilities/calendarFeed'

describe('generateICalFeed', () => {
  const municipalityNames = new Map([
    [1, 'Salvador'],
    [2, 'Feira de Santana'],
  ])

  it('generates a valid VCALENDAR with VEVENT entries', () => {
    const activities = [
      {
        id: 1,
        slug: 'comicio-salvador',
        title: 'Comício em Salvador',
        status: 'confirmado' as const,
        startAt: '2026-08-15T19:00:00.000Z',
        endAt: '2026-08-15T22:00:00.000Z',
        municipality: 1,
        locality: 'Centro',
        tags: ['comício', 'campanha'],
        deputyPresent: true,
        updatedAt: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ] as unknown as Parameters<typeof generateICalFeed>[0]

    const result = generateICalFeed(activities, 'Agenda do Candidato', municipalityNames)

    expect(result).toContain('BEGIN:VCALENDAR')
    expect(result).toContain('END:VCALENDAR')
    expect(result).toContain('BEGIN:VEVENT')
    expect(result).toContain('END:VEVENT')
    expect(result).toContain('UID:comicio-salvador@teqo.jorgesolla.com.br')
    expect(result).toContain('SUMMARY:[Salvador] Comício em Salvador')
    expect(result).toContain('DTSTART:20260815T190000Z')
    expect(result).toContain('DTEND:20260815T220000Z')
    expect(result).toContain('X-WR-CALNAME:Agenda do Candidato')
    expect(result).toContain('X-PUBLISHED-TTL:PT1H')
  })

  it('excludes cancelled activities', () => {
    const activities = [
      {
        id: 1,
        slug: 'evento-cancelado',
        title: 'Evento Cancelado',
        status: 'cancelado' as const,
        startAt: '2026-08-15T19:00:00.000Z',
        municipality: 1,
        updatedAt: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ] as unknown as Parameters<typeof generateICalFeed>[0]

    const result = generateICalFeed(activities, 'Test', municipalityNames)

    expect(result).not.toContain('BEGIN:VEVENT')
    expect(result).not.toContain('evento-cancelado')
  })

  it('exports all-day commitments as date values with the exclusive end (C104)', () => {
    const activities = [
      {
        id: 2,
        slug: 'giro-interior',
        title: 'Giro no interior',
        status: 'confirmado' as const,
        allDay: true,
        startAt: '2026-08-10T03:00:00.000Z',
        endAt: '2026-08-12T03:00:00.000Z',
        municipality: 2,
        tags: ['giro'],
        deputyPresent: true,
        updatedAt: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
      },
      {
        id: 3,
        slug: 'dia-inteiro-avulso',
        title: 'Dia inteiro avulso',
        status: 'confirmado' as const,
        allDay: true,
        startAt: '2026-08-20T03:00:00.000Z',
        endAt: '2026-08-20T03:00:00.000Z',
        municipality: 1,
        updatedAt: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ] as unknown as Parameters<typeof generateICalFeed>[0]

    const result = generateICalFeed(activities, 'Test', municipalityNames)

    expect(result).toContain('DTSTART;VALUE=DATE:20260810')
    expect(result).toContain('DTEND;VALUE=DATE:20260813')
    expect(result).toContain('DTSTART;VALUE=DATE:20260820')
    expect(result).toContain('DTEND;VALUE=DATE:20260821')
    expect(result).not.toContain('DTSTART:20260810')
  })

  it('escapes special characters in text fields', () => {
    const activities = [
      {
        id: 1,
        slug: 'evento-especial',
        title: 'Reunião; com vírgulas, e quebras\nde linha',
        status: 'confirmado' as const,
        startAt: '2026-08-15T19:00:00.000Z',
        municipality: 1,
        updatedAt: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ] as unknown as Parameters<typeof generateICalFeed>[0]

    const result = generateICalFeed(activities, 'Test', municipalityNames)

    expect(result).toContain('Reunião\\; com vírgulas\\, e quebras\\nde linha')
  })

  it('uses title only when municipality name is not available', () => {
    const activities = [
      {
        id: 1,
        slug: 'evento-sem-municipio',
        title: 'Evento Genérico',
        status: 'confirmado' as const,
        startAt: '2026-08-15T19:00:00.000Z',
        municipality: 999,
        updatedAt: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ] as unknown as Parameters<typeof generateICalFeed>[0]

    const result = generateICalFeed(activities, 'Test', municipalityNames)

    expect(result).toContain('SUMMARY:Evento Genérico')
  })

  it('uses startAt as endAt when endAt is not provided', () => {
    const activities = [
      {
        id: 1,
        slug: 'evento-sem-fim',
        title: 'Evento Sem Fim',
        status: 'confirmado' as const,
        startAt: '2026-08-15T19:00:00.000Z',
        endAt: null,
        municipality: 1,
        updatedAt: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ] as unknown as Parameters<typeof generateICalFeed>[0]

    const result = generateICalFeed(activities, 'Test', municipalityNames)

    expect(result).toContain('DTSTART:20260815T190000Z')
    expect(result).toContain('DTEND:20260815T190000Z')
  })
})

describe('buildICalFeedResponse (C113)', () => {
  const activities = [
    {
      id: 1,
      slug: 'comicio-salvador',
      title: 'Comício em Salvador',
      status: 'confirmado' as const,
      startAt: '2026-08-15T19:00:00.000Z',
      endAt: '2026-08-15T22:00:00.000Z',
      municipality: 1,
      locality: 'Centro',
      tags: ['comício', 'campanha'],
      deputyPresent: true,
      updatedAt: '2026-08-01T10:00:00.000Z',
      createdAt: '2026-08-01T09:00:00.000Z',
    },
  ] as unknown as Parameters<typeof generateICalFeed>[0]

  const icalContent = generateICalFeed(
    activities,
    'Agenda do Candidato',
    new Map([[1, 'Salvador']]),
  )
  const feed = { updatedAt: '2026-08-02T08:00:00.000Z' }

  const requestWith = (headers: Record<string, string>) =>
    new Request('https://example.test/campanha/agenda/ical/secret', { headers })

  it('serves the feed with a freshness contract: no-cache, ETag and Last-Modified', async () => {
    const response = buildICalFeedResponse(icalContent, activities, feed, requestWith({}))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/calendar')
    expect(response.headers.get('Cache-Control')).toBe('public, no-cache')
    expect(response.headers.get('ETag')).toMatch(/^"[0-9a-f]{64}"$/)
    expect(response.headers.get('Last-Modified')).toBe('Sun, 02 Aug 2026 08:00:00 GMT')
    expect(await response.text()).toBe(icalContent)
  })

  it('keeps the ETag stable for identical content and changes it with the body', () => {
    const first = buildICalFeedResponse(icalContent, activities, feed, requestWith({}))
    const second = buildICalFeedResponse(icalContent, activities, feed, requestWith({}))

    expect(first.headers.get('ETag')).toBe(second.headers.get('ETag'))

    const edited = buildICalFeedResponse(
      icalContent.replace('Comício em Salvador', 'Comício em Salvador (novo local)'),
      activities,
      feed,
      requestWith({}),
    )
    expect(edited.headers.get('ETag')).not.toBe(first.headers.get('ETag'))
  })

  it('answers 304 without a body when If-None-Match matches the current ETag', async () => {
    const fresh = buildICalFeedResponse(icalContent, activities, feed, requestWith({}))
    const etag = fresh.headers.get('ETag')!

    const revalidated = buildICalFeedResponse(
      icalContent,
      activities,
      feed,
      requestWith({ 'if-none-match': etag }),
    )

    expect(revalidated.status).toBe(304)
    expect(revalidated.headers.get('ETag')).toBe(etag)
    expect(revalidated.headers.get('Cache-Control')).toBe('public, no-cache')
    expect(await revalidated.text()).toBe('')
  })

  it('answers 304 for wildcard and multi-value If-None-Match lists, weak or strong', () => {
    const etag = buildICalFeedResponse(icalContent, activities, feed, requestWith({})).headers.get(
      'ETag',
    )!

    for (const header of ['*', `"stale-1", ${etag}`, `W/${etag}`]) {
      const revalidated = buildICalFeedResponse(
        icalContent,
        activities,
        feed,
        requestWith({ 'if-none-match': header }),
      )
      expect(revalidated.status, header).toBe(304)
    }
  })

  it('answers 200 when If-None-Match carries a stale ETag', () => {
    const revalidated = buildICalFeedResponse(
      icalContent,
      activities,
      feed,
      requestWith({ 'if-none-match': '"stale-etag"' }),
    )

    expect(revalidated.status).toBe(200)
  })

  it('never answers 304 to If-Modified-Since alone (deletion blind spot)', () => {
    const response = buildICalFeedResponse(
      icalContent,
      activities,
      feed,
      requestWith({ 'if-modified-since': 'Mon, 03 Aug 2026 08:00:00 GMT' }),
    )

    expect(response.status).toBe(200)
  })
})
