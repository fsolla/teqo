/**
 * C196/C197 — the reel package metadata: the contract the private library
 * (C195) ingests. `shotListHash` identifies the reel version; re-rendering the
 * same shot list updates the same entry. C197 added `coverAlt` (required by
 * the ingest), `durationSeconds`, the `voice` of the TTS draft and the
 * `artifacts` the package actually ships (the transcription always; the
 * audio files when `--audio`).
 */

import { REEL, seconds } from './reelTimeline.mjs'

/**
 * @param {{ shotList: { slug: string, title: string, feature: string, coverAlt?: string }, hash: string, durationMs: number, ffmpeg: string, generatedAt?: Date, audio?: boolean, voice?: string | null, artifacts?: string[] }} options
 */
export const buildReelMetadata = ({
  shotList,
  hash,
  durationMs,
  ffmpeg,
  generatedAt = new Date(),
  audio = false,
  voice = null,
  artifacts = [],
}) => ({
  slug: shotList.slug,
  title: shotList.title,
  feature: shotList.feature,
  shotListHash: hash,
  coverAlt: shotList.coverAlt,
  durationMs: Math.round(durationMs),
  durationSeconds: seconds(durationMs),
  width: REEL.width,
  height: REEL.height,
  fps: REEL.fps,
  codec: 'h264',
  audio,
  ...(audio && voice ? { voice } : {}),
  artifacts: [...artifacts],
  generatedAt: generatedAt.toISOString(),
  ffmpeg,
})
