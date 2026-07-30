import { describe, expect, it } from 'vitest'

import { truncateNameAtWordBoundary } from '@/lib/leadershipNameTruncate'

describe('truncateNameAtWordBoundary', () => {
  it('returns the full name when it fits', () => {
    expect(truncateNameAtWordBoundary('Maria Silva', 20)).toBe('Maria Silva')
  })

  it('truncates at the last whole word that fits', () => {
    expect(truncateNameAtWordBoundary('Fernando da Costa Lima', 12)).toBe('Fernando da…')
  })

  it('falls back to character slice when the first word exceeds the limit', () => {
    expect(truncateNameAtWordBoundary('Supercalifragilistic', 8)).toBe('Superca…')
  })
})
