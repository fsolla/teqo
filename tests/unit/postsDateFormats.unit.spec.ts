import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatRelativePostDate, POST_TYPE_BADGE_LABELS } from '@/utilities/posts'

describe('formatRelativePostDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads missing or invalid dates as null', () => {
    expect(formatRelativePostDate(undefined)).toBeNull()
    expect(formatRelativePostDate(null)).toBeNull()
    expect(formatRelativePostDate('not-a-date')).toBeNull()
  })

  it('reads anything up to a minute ago as "agora"', () => {
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'))
    expect(formatRelativePostDate('2026-08-17T12:00:00Z')).toBe('agora')
    expect(formatRelativePostDate('2026-08-17T11:59:59Z')).toBe('agora')
    expect(formatRelativePostDate('2026-08-17T12:00:30Z')).toBe('agora')
  })

  it('formats minutes, hours and days in Portuguese with auto pluralization', () => {
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'))
    expect(formatRelativePostDate('2026-08-17T11:55:00Z')).toBe('há 5 minutos')
    expect(formatRelativePostDate('2026-08-17T10:30:00Z')).toBe('há 1 hora')
    expect(formatRelativePostDate('2026-08-17T08:00:00Z')).toBe('há 4 horas')
    expect(formatRelativePostDate('2026-08-16T12:00:00Z')).toBe('há 1 dia')
  })

  it('floors partial units so 1h59m reads as "há 1 hora"', () => {
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'))
    expect(formatRelativePostDate('2026-08-17T10:01:00Z')).toBe('há 1 hora')
  })

  it('falls back to the long absolute date past 48 hours', () => {
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'))
    expect(formatRelativePostDate('2026-08-16T12:00:00Z')).toBe('há 1 dia')
    expect(formatRelativePostDate('2026-08-15T12:00:00Z')).toBe('15 de agosto de 2026')
    expect(formatRelativePostDate('2026-07-17T12:00:00Z')).toBe('17 de julho de 2026')
  })
})

describe('POST_TYPE_BADGE_LABELS', () => {
  it('spells the four types in the singular for card badges', () => {
    expect(POST_TYPE_BADGE_LABELS).toEqual({
      noticia: 'Notícia',
      campanha: 'Campanha',
      artigo: 'Artigo',
      evento: 'Evento',
    })
  })
})
