import { describe, expect, it } from 'vitest'

import {
  RELATION_AVATAR_MIN_OVERLAP_PX,
  RELATION_AVATAR_SIZE_PX,
  relationAvatarOverlapPx,
} from '@/lib/relationAvatarOverlap'

/**
 * The mobile relation group's content width at the 390px e2e viewport:
 * (390 − 2·16 card padding − 2·12 gaps) / 3 groups = 111.33 → clientWidth 111.
 */
const GROUP_WIDTH_390 = 111

/** Total span of the pile: first avatar full, each next one overlapped. */
const pileSpan = (count: number, overlap: number) =>
  RELATION_AVATAR_SIZE_PX + (count - 1) * (RELATION_AVATAR_SIZE_PX - overlap)

describe('relationAvatarOverlapPx', () => {
  it('returns 0 for a single avatar (nothing to overlap)', () => {
    expect(relationAvatarOverlapPx(1, GROUP_WIDTH_390)).toBe(0)
    expect(relationAvatarOverlapPx(0, GROUP_WIDTH_390)).toBe(0)
  })

  it('guarantees the minimum overlap even with two avatars on a wide group', () => {
    expect(relationAvatarOverlapPx(2, GROUP_WIDTH_390)).toBe(RELATION_AVATAR_MIN_OVERLAP_PX)
    expect(relationAvatarOverlapPx(2, 300)).toBe(RELATION_AVATAR_MIN_OVERLAP_PX)
  })

  it('grows the overlap with the count so the pile fits the group exactly', () => {
    for (const count of [2, 3, 5, 6, 8, 12, 20]) {
      const overlap = relationAvatarOverlapPx(count, GROUP_WIDTH_390)
      expect(overlap).toBeGreaterThanOrEqual(RELATION_AVATAR_MIN_OVERLAP_PX)
      expect(pileSpan(count, overlap)).toBeLessThanOrEqual(GROUP_WIDTH_390 + 0.01)
      if (overlap > RELATION_AVATAR_MIN_OVERLAP_PX) {
        expect(pileSpan(count, overlap)).toBeGreaterThan(GROUP_WIDTH_390 - 0.01)
      }
    }
  })

  it('fits narrower viewports too (360px group ≈ 101px)', () => {
    const width = 101
    for (const count of [2, 5, 6, 8, 12]) {
      const overlap = relationAvatarOverlapPx(count, width)
      expect(pileSpan(count, overlap)).toBeLessThanOrEqual(width + 0.01)
    }
  })

  it('overlap never goes below the minimum once there are two or more avatars', () => {
    for (const count of [2, 4, 9]) {
      expect(relationAvatarOverlapPx(count, 500)).toBe(RELATION_AVATAR_MIN_OVERLAP_PX)
    }
  })

  it('falls back to the minimum overlap when the width is not a finite number', () => {
    expect(relationAvatarOverlapPx(3, Number.NaN)).toBe(RELATION_AVATAR_MIN_OVERLAP_PX)
    expect(relationAvatarOverlapPx(3, Number.POSITIVE_INFINITY)).toBe(
      RELATION_AVATAR_MIN_OVERLAP_PX,
    )
  })
})
