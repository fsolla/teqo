import { describe, expect, it } from 'vitest'

import { formatRelativeAge } from '@/utilities/formatRelativeAge'

const now = Date.parse('2026-07-19T12:00:00.000Z')

describe('formatRelativeAge', () => {
  it('formats minutes and hours with numeric cues', () => {
    expect(formatRelativeAge(now - 5 * 60_000, now)).toContain('5')
    expect(formatRelativeAge(now - 3 * 60 * 60_000, now)).toContain('3')
  })

  it('formats multi-day spans via Intl auto rules', () => {
    expect(formatRelativeAge(now - 2 * 24 * 60 * 60_000, now)).toBe(
      new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(-2, 'day'),
    )
  })
})
