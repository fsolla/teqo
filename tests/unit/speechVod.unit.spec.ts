// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  correctedExcerptOffsetSeconds,
  excerptOffsetSeconds,
  measuredVideoLagSeconds,
  parseYoutubeVideoId,
  sessionLagSeconds,
  youtubeThumbnailUrl,
} from '@/lib/speechVod'

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

describe('youtubeThumbnailUrl', () => {
  it('builds the hqdefault cover for a parsed video id (intent literal)', () => {
    expect(youtubeThumbnailUrl('lLhRDkSPw0A')).toBe(
      'https://i.ytimg.com/vi/lLhRDkSPw0A/hqdefault.jpg',
    )
  })

  it('returns null when there is no video id', () => {
    expect(youtubeThumbnailUrl(null)).toBeNull()
    expect(youtubeThumbnailUrl('')).toBeNull()
  })
})

describe('sessionLagSeconds (C172)', () => {
  it('measures the video start delay in BRT wall clock (Fase 0 literals)', () => {
    // 2026-08-11: session slot 15:32 BRT; broadcast started 18:32:57Z = 15:32:57 BRT.
    expect(sessionLagSeconds('2026-08-11T18:32:57Z', '2026-08-11T15:32')).toBe(57)
    // 2018-03-13: slot 14:00 BRT; broadcast started 17:00:46Z = 14:00:46 BRT.
    expect(sessionLagSeconds('2018-03-13T17:00:46Z', '2018-03-13T14:00')).toBe(46)
  })

  it('reads both sides as BRT wall clock across an old DST transition', () => {
    // 2018-11-04 00:00 BRT: clocks move to -02:00; 14:00Z reads as 12:00 BRT.
    expect(sessionLagSeconds('2018-11-04T14:00:00Z', '2018-11-04T11:00')).toBe(3600)
  })

  it('returns null when the video does not start after the declared slot', () => {
    expect(sessionLagSeconds('2026-08-11T18:32:00Z', '2026-08-11T15:32')).toBeNull()
    expect(sessionLagSeconds('2026-08-11T18:31:00Z', '2026-08-11T15:32')).toBeNull()
  })

  it('returns null when the gap is too large to be a session start delay', () => {
    expect(sessionLagSeconds('2026-08-11T20:00:00Z', '2026-08-11T15:32')).toBeNull()
  })

  it('returns null on unparseable or out-of-range input', () => {
    expect(sessionLagSeconds(null, '2026-08-11T15:32')).toBeNull()
    expect(sessionLagSeconds('', '2026-08-11T15:32')).toBeNull()
    expect(sessionLagSeconds('sem data', '2026-08-11T15:32')).toBeNull()
    expect(sessionLagSeconds('2026-08-11T18:32:57Z', 'sem data')).toBeNull()
    expect(sessionLagSeconds('2026-08-11T18:32:57Z', '2026-08-11T25:00')).toBeNull()
  })
})

describe('measuredVideoLagSeconds (C172)', () => {
  it('returns the lag measured for that recording (release + staging evidence)', () => {
    // Fala 997 (Issue #1082) and fala 641 (C163).
    expect(measuredVideoLagSeconds('DC_i9Kp1LVk')).toBe(13)
    expect(measuredVideoLagSeconds('2cX_gKkJH7Q')).toBe(37)
    // Staging reports of 2026-09-16.
    expect(measuredVideoLagSeconds('hAUJ3fXgsIQ')).toBe(31)
    expect(measuredVideoLagSeconds('hZ9Yl4MFHQs')).toBe(10)
    expect(measuredVideoLagSeconds('nHHqPaJEERI')).toBe(89)
  })

  it('returns null for a recording that was never measured', () => {
    expect(measuredVideoLagSeconds('lLhRDkSPw0A')).toBeNull()
    expect(measuredVideoLagSeconds(null)).toBeNull()
  })
})

describe('correctedExcerptOffsetSeconds (C172)', () => {
  it('moves the offset from the declared slot to the video start (acceptance literals)', () => {
    // Fala 997: app 11962s → YouTube share 11949s.
    expect(correctedExcerptOffsetSeconds(11962, 13)).toBe(11949)
    // Fala 641: Câmara excerpt 645s → t=608s.
    expect(correctedExcerptOffsetSeconds(645, 37)).toBe(608)
  })

  it('keeps the session offset when the lag is unknown (today behaviour)', () => {
    expect(correctedExcerptOffsetSeconds(2634, null)).toBe(2634)
  })

  it('never goes negative and never invents an offset', () => {
    expect(correctedExcerptOffsetSeconds(5, 13)).toBe(0)
    expect(correctedExcerptOffsetSeconds(null, 13)).toBeNull()
    expect(correctedExcerptOffsetSeconds(null, null)).toBeNull()
  })
})
