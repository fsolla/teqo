// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { excerptOffsetSeconds, parseYoutubeVideoId } from '@/lib/speechVod'

/**
 * The VOD URL/status/duration contracts moved from `scripts/lib/camaraSpeeches.mjs`
 * to `@/lib/speechVod` (C162) stay pinned by `camaraSpeeches.unit.spec.ts`, which
 * imports them through the script's re-export — this file owns the new pure rules.
 */

describe('excerptOffsetSeconds', () => {
  it('measures the offset between the excerpt and the session start (intent literal)', () => {
    expect(excerptOffsetSeconds(1786473834650, '2026-08-11T15:00')).toBe(2634)
  })

  it('matches the C153 import fixture (import literal)', () => {
    expect(excerptOffsetSeconds(1675801808560, '2023-02-07T15:00')).toBe(9008)
  })

  it('reads both sides as BRT wall clock across an old DST transition', () => {
    // 2018-11-04 00:00 BRT: clocks move to -02:00; 14:00Z reads as 12:00 BRT.
    expect(excerptOffsetSeconds(1541340000000, '2018-11-04T11:00')).toBe(3600)
    // The day before the transition still reads at -03:00: 14:00Z = 11:00 BRT.
    expect(excerptOffsetSeconds(1541253600000, '2018-11-03T10:00')).toBe(3600)
  })

  it('crosses midnight without losing the date', () => {
    // 2024-05-15 02:30Z = 2024-05-14 23:30 BRT.
    expect(excerptOffsetSeconds(1715740200000, '2024-05-14T23:00')).toBe(1800)
  })

  it('accepts the space spelling of the naive datetime', () => {
    expect(excerptOffsetSeconds(1786473834650, '2026-08-11 15:00')).toBe(2634)
  })

  it('returns null when the excerpt precedes the session start', () => {
    expect(excerptOffsetSeconds(1786473834650, '2026-08-11T16:00')).toBeNull()
  })

  it('returns null on unparseable or out-of-range input', () => {
    expect(excerptOffsetSeconds(null, '2026-08-11T15:00')).toBeNull()
    expect(excerptOffsetSeconds(0, '2026-08-11T15:00')).toBeNull()
    expect(excerptOffsetSeconds(1786473834650, null)).toBeNull()
    expect(excerptOffsetSeconds(1786473834650, 'sem data')).toBeNull()
    expect(excerptOffsetSeconds(1786473834650, '2026-13-11T15:00')).toBeNull()
    expect(excerptOffsetSeconds(1786473834650, '2026-08-11T25:00')).toBeNull()
    expect(excerptOffsetSeconds(1786473834650, '2026-08-11T15:75')).toBeNull()
  })
})

describe('parseYoutubeVideoId', () => {
  const videoId = 'lLhRDkSPw0A'

  it('parses the open-data watch link', () => {
    expect(parseYoutubeVideoId(`https://www.youtube.com/watch?v=${videoId}`)).toBe(videoId)
  })

  it('parses the shortened, embed, live, shorts and mobile forms', () => {
    expect(parseYoutubeVideoId(`https://youtu.be/${videoId}?t=30`)).toBe(videoId)
    expect(parseYoutubeVideoId(`https://www.youtube.com/embed/${videoId}`)).toBe(videoId)
    expect(parseYoutubeVideoId(`https://www.youtube-nocookie.com/embed/${videoId}`)).toBe(videoId)
    expect(parseYoutubeVideoId(`https://www.youtube.com/live/${videoId}?feature=share`)).toBe(
      videoId,
    )
    expect(parseYoutubeVideoId(`https://www.youtube.com/shorts/${videoId}`)).toBe(videoId)
    expect(parseYoutubeVideoId(`https://m.youtube.com/watch?v=${videoId}`)).toBe(videoId)
  })

  it('rejects non-YouTube hosts, unparseable values and non-video links', () => {
    expect(parseYoutubeVideoId(`https://example.com/watch?v=${videoId}`)).toBeNull()
    expect(parseYoutubeVideoId(`youtube.com/watch?v=${videoId}`)).toBeNull()
    expect(parseYoutubeVideoId('https://www.youtube.com/playlist?list=PL123')).toBeNull()
    expect(parseYoutubeVideoId('https://www.youtube.com/')).toBeNull()
    expect(parseYoutubeVideoId('')).toBeNull()
    expect(parseYoutubeVideoId(null)).toBeNull()
  })

  it('rejects an id that does not look like a YouTube id', () => {
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?v=ab')).toBeNull()
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?v=../etc/passwd')).toBeNull()
  })
})
