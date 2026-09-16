import { describe, expect, it } from 'vitest'

import {
  extendRangeToSegment,
  initialExcerptRange,
  moveRangeEdge,
  normalizeExcerptRange,
  rangeDurationSeconds,
  secondsFromTrackRatio,
  segmentBoundarySeconds,
  selectSegmentRange,
  snapSecondsToSegmentBoundary,
} from '@/lib/speechExcerptSelection'

/** ASR segments are fractional seconds — the picker works in whole seconds. */
const SEGMENTS = [
  { startSeconds: 0, endSeconds: 4.2 },
  { startSeconds: 43.6, endSeconds: 50.1 },
  { startSeconds: 50.1, endSeconds: 130.9 },
  { startSeconds: 130.9, endSeconds: 252 },
] as const

describe('normalizeExcerptRange', () => {
  it('never leaves 0..duration and reads whole seconds', () => {
    expect(normalizeExcerptRange(10.4, 20.7, 100)).toEqual({
      startSeconds: 10,
      endSeconds: 21,
    })
    expect(normalizeExcerptRange(-5, 500, 100)).toEqual({ startSeconds: 0, endSeconds: 100 })
    expect(normalizeExcerptRange(80, 20, 100)).toEqual({ startSeconds: 20, endSeconds: 80 })
  })

  it('grows a short range to the 5 s minimum', () => {
    expect(normalizeExcerptRange(0, 4, 100)).toEqual({ startSeconds: 0, endSeconds: 5 })
  })

  it('grows backwards when the speech ends first', () => {
    expect(normalizeExcerptRange(248, 252, 252)).toEqual({ startSeconds: 247, endSeconds: 252 })
  })

  it('has no upper cap — the speech duration is the limit', () => {
    expect(normalizeExcerptRange(0, 500, 600)).toEqual({ startSeconds: 0, endSeconds: 500 })
    expect(normalizeExcerptRange(0, 600, 600)).toEqual({ startSeconds: 0, endSeconds: 600 })
    expect(normalizeExcerptRange(500, 500, 600)).toEqual({ startSeconds: 500, endSeconds: 505 })
  })

  it('is null when the duration cannot hold the minimum', () => {
    expect(normalizeExcerptRange(0, 4, 4)).toBeNull()
    expect(normalizeExcerptRange(0, 4, Number.NaN)).toBeNull()
  })

  it('treats non-finite edges as zero instead of leaking NaN', () => {
    expect(normalizeExcerptRange(Number.NaN, Number.NaN, 100)).toEqual({
      startSeconds: 0,
      endSeconds: 5,
    })
  })
})

describe('selectSegmentRange', () => {
  it('selects the whole phrase with fractional edges snapped outward', () => {
    expect(selectSegmentRange(SEGMENTS, 1, 252)).toEqual({ startSeconds: 43, endSeconds: 51 })
  })

  it('extends a phrase shorter than 5 s', () => {
    expect(selectSegmentRange(SEGMENTS, 0, 252)).toEqual({ startSeconds: 0, endSeconds: 5 })
  })

  it('is null for an unknown phrase or an impossible speech', () => {
    expect(selectSegmentRange(SEGMENTS, 9, 252)).toBeNull()
    expect(selectSegmentRange(SEGMENTS, 0, 3)).toBeNull()
  })
})

describe('initialExcerptRange', () => {
  it('starts on the first phrase', () => {
    expect(initialExcerptRange(SEGMENTS, 252)).toEqual({ startSeconds: 0, endSeconds: 5 })
  })

  it('falls back to the first 5 s without ASR', () => {
    expect(initialExcerptRange([], 252)).toEqual({ startSeconds: 0, endSeconds: 5 })
    expect(initialExcerptRange([], 3)).toBeNull()
  })
})

describe('extendRangeToSegment', () => {
  const range = { startSeconds: 43, endSeconds: 51 }

  it('extends forward to the clicked phrase end', () => {
    expect(extendRangeToSegment(range, SEGMENTS, 2, 252)).toEqual({
      startSeconds: 43,
      endSeconds: 131,
    })
  })

  it('extends backwards to the clicked phrase start', () => {
    expect(extendRangeToSegment(range, SEGMENTS, 0, 252)).toEqual({
      startSeconds: 0,
      endSeconds: 51,
    })
  })

  it('re-selects a phrase already inside the range', () => {
    expect(extendRangeToSegment({ startSeconds: 0, endSeconds: 131 }, SEGMENTS, 1, 252)).toEqual({
      startSeconds: 43,
      endSeconds: 51,
    })
  })

  it('keeps the range when the phrase is unknown', () => {
    expect(extendRangeToSegment(range, SEGMENTS, 9, 252)).toEqual(range)
  })

  it('extends to the end of a long phrase without a cap', () => {
    expect(extendRangeToSegment(range, SEGMENTS, 3, 252)).toEqual({
      startSeconds: 43,
      endSeconds: 252,
    })
  })
})

describe('moveRangeEdge', () => {
  const range = { startSeconds: 43, endSeconds: 51 }

  it('moves the start down to the beginning and up to the end minus 5 s', () => {
    expect(moveRangeEdge(range, 'start', 0, 252)).toEqual({ startSeconds: 0, endSeconds: 51 })
    expect(moveRangeEdge(range, 'start', 80, 252)).toEqual({ startSeconds: 46, endSeconds: 51 })
    expect(moveRangeEdge(range, 'start', 20, 252)).toEqual({ startSeconds: 20, endSeconds: 51 })
  })

  it('moves the end between start + 5 s and the speech duration', () => {
    expect(moveRangeEdge(range, 'end', 0, 252)).toEqual({ startSeconds: 43, endSeconds: 48 })
    expect(moveRangeEdge(range, 'end', 500, 252)).toEqual({ startSeconds: 43, endSeconds: 252 })
    expect(moveRangeEdge(range, 'end', 200, 252)).toEqual({ startSeconds: 43, endSeconds: 200 })
  })

  it('never leaves the speech duration', () => {
    expect(moveRangeEdge({ startSeconds: 198, endSeconds: 203 }, 'end', 500, 203)).toEqual({
      startSeconds: 198,
      endSeconds: 203,
    })
    expect(moveRangeEdge({ startSeconds: 240, endSeconds: 252 }, 'start', 10, 252)).toEqual({
      startSeconds: 10,
      endSeconds: 252,
    })
  })

  it('ignores non-finite input', () => {
    expect(moveRangeEdge(range, 'end', Number.NaN, 252)).toEqual({
      startSeconds: 43,
      endSeconds: 48,
    })
  })
})

describe('track geometry', () => {
  it('converts the pointer ratio to whole seconds inside the duration', () => {
    expect(secondsFromTrackRatio(0.5, 100)).toBe(50)
    expect(secondsFromTrackRatio(0.333, 90)).toBe(30)
    expect(secondsFromTrackRatio(-1, 100)).toBe(0)
    expect(secondsFromTrackRatio(2, 100)).toBe(100)
    expect(secondsFromTrackRatio(Number.NaN, 100)).toBe(0)
  })

  it('lists the phrase boundaries as ascending whole seconds without duplicates', () => {
    expect(segmentBoundarySeconds(SEGMENTS)).toEqual([0, 5, 43, 50, 51, 130, 131, 252])
  })

  it('snaps to a boundary within the tolerance and stays put outside it', () => {
    expect(snapSecondsToSegmentBoundary(45, SEGMENTS, 3)).toBe(43)
    expect(snapSecondsToSegmentBoundary(45, SEGMENTS, 1)).toBe(45)
  })

  it('derives the span between the edges', () => {
    expect(rangeDurationSeconds({ startSeconds: 43, endSeconds: 130 })).toBe(87)
  })
})
