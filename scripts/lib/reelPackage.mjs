/**
 * C196 — the reel package metadata: the contract the private library (C195)
 * ingests. `shotListHash` identifies the reel version; re-rendering the same
 * shot list updates the same entry.
 */

import { REEL } from './reelTimeline.mjs'

export const buildReelMetadata = ({
  shotList,
  hash,
  durationMs,
  ffmpeg,
  generatedAt = new Date(),
}) => ({
  slug: shotList.slug,
  title: shotList.title,
  feature: shotList.feature,
  shotListHash: hash,
  durationMs: Math.round(durationMs),
  width: REEL.width,
  height: REEL.height,
  fps: REEL.fps,
  codec: 'h264',
  audio: false,
  generatedAt: generatedAt.toISOString(),
  ffmpeg,
})
