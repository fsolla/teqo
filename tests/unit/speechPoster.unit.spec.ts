// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildSpeechPosterFfmpegArgs,
  speechPosterFilename,
  speechPosterHref,
  speechPosterOffsetSeconds,
  speechPosterTarget,
} from '@/lib/speechPoster'

describe('speechPosterOffsetSeconds', () => {
  it('points at the middle of the speech (intent literal)', () => {
    expect(speechPosterOffsetSeconds(252)).toBe(126)
    expect(speechPosterOffsetSeconds(601)).toBe(300)
  })

  it('returns null without a usable duration', () => {
    expect(speechPosterOffsetSeconds(0)).toBeNull()
    expect(speechPosterOffsetSeconds(-5)).toBeNull()
    expect(speechPosterOffsetSeconds(null)).toBeNull()
    expect(speechPosterOffsetSeconds(undefined)).toBeNull()
    expect(speechPosterOffsetSeconds(Number.NaN)).toBeNull()
  })
})

describe('speechPosterTarget', () => {
  const coordinates = { eventId: 67091, audioId: 558641, excerptTMs: 1675801808560 }

  it('joins the Câmara coordinates with the midpoint, stored VOD or not', () => {
    const expected = {
      eventId: 67091,
      audioId: 558641,
      excerptTms: 1675801808560,
      offsetSeconds: 126,
    }

    expect(speechPosterTarget({ ...coordinates, durationSeconds: 252 })).toEqual(expected)
    expect(
      speechPosterTarget({
        ...coordinates,
        durationSeconds: 252,
        vodPlaybackUrl: 'https://vod.camara.leg.br/x',
      }),
    ).toEqual(expected)
  })

  it('is ineligible without any coordinate or without a duration', () => {
    expect(speechPosterTarget({ ...coordinates, durationSeconds: 252, eventId: null })).toBeNull()
    expect(speechPosterTarget({ ...coordinates, durationSeconds: 252, audioId: null })).toBeNull()
    expect(
      speechPosterTarget({ ...coordinates, durationSeconds: 252, excerptTMs: null }),
    ).toBeNull()
    expect(speechPosterTarget({ ...coordinates, durationSeconds: 0 })).toBeNull()
    expect(speechPosterTarget({ durationSeconds: 252 })).toBeNull()
  })
})

describe('speechPosterFilename / speechPosterHref', () => {
  it('builds the deterministic cache name and the internal route', () => {
    expect(speechPosterFilename(42)).toBe('speech-poster-42.jpg')
    expect(speechPosterHref(42)).toBe('/campanha/comunicacao/acervo/42/poster')
  })
})

describe('buildSpeechPosterFfmpegArgs', () => {
  it('seeks to the midpoint and takes a single scaled frame', () => {
    const args = buildSpeechPosterFfmpegArgs({
      inputPath: '/tmp/source.mp4',
      outputPath: '/tmp/speech-poster-42.jpg',
      atSeconds: 126.4,
    })

    expect(args).toEqual([
      '-nostdin',
      '-hide_banner',
      '-y',
      '-ss',
      '126',
      '-i',
      '/tmp/source.mp4',
      '-frames:v',
      '1',
      '-vf',
      'scale=480:-2',
      '-q:v',
      '2',
      '-an',
      '/tmp/speech-poster-42.jpg',
    ])
    // The seek is an input option: before `-i`, never after.
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
  })

  it('never seeks to a negative instant', () => {
    const args = buildSpeechPosterFfmpegArgs({
      inputPath: 'in.mp4',
      outputPath: 'out.jpg',
      atSeconds: -3,
    })

    expect(args[args.indexOf('-ss') + 1]).toBe('0')
  })
})
