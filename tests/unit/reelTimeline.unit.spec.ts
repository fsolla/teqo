import { describe, expect, it } from 'vitest'

import {
  buildZoomExpressions,
  captionWindow,
  captureScenePlan,
  captureSceneWindow,
  graphicClipWindow,
  piecewiseLinear,
  REEL,
  totalDurationMs,
  wallToTimelineMs,
  zoomKeyframes,
} from '../../scripts/lib/reelTimeline.mjs'

// C196 — the timeline maps the wall-clock action log onto the recorded video
// timeline; the zoom expressions and caption windows are pure and pinned here.

const firstFrameWallMs = 1_000

const scene = (overrides: Record<string, unknown> = {}) => ({
  id: 'step-1',
  kind: 'capture' as const,
  badge: { number: 1, total: 3, label: 'Escolha um modelo' },
  caption: { parts: [{ text: 'Toque.' }] },
  setup: [],
  steps: [],
  leadInMs: 700,
  trailOutMs: 800,
  captionDelayMs: 250,
  captionDurationMs: null,
  ...overrides,
})

const actions = [
  { scene: 'step-1', kind: 'sceneStart', at: 2_000 },
  {
    scene: 'step-1',
    kind: 'click',
    at: 3_000,
    approachAt: 2_500,
    arriveAt: 2_820,
    x: 180,
    y: 320,
  },
  {
    scene: 'step-1',
    kind: 'click',
    at: 3_200,
    approachAt: 3_200,
    arriveAt: 3_200,
    x: 10,
    y: 10,
    zoom: false,
  },
  { scene: 'step-1', kind: 'sceneEnd', at: 4_500 },
]

describe('reelTimeline', () => {
  it('maps wall clock to the video timeline and the safe-area constants', () => {
    expect(wallToTimelineMs(2_000, firstFrameWallMs)).toBe(1_000)
    expect(REEL.safeArea.topPx).toBe(250)
    expect(REEL.safeArea.bottomPx).toBe(672)
    expect(REEL.caption.centerYPx).toBe(1_160)
  })

  it('builds the scene window and drops non-zoom clicks', () => {
    const window = captureSceneWindow({ scene: scene(), actions, firstFrameWallMs })
    expect(window.startMs).toBe(1_000)
    expect(window.endMs).toBe(3_500)
    expect(window.clicks).toHaveLength(1)
    expect(window.clicks[0]).toEqual({
      approachAtMs: 1_500,
      arriveAtMs: 1_820,
      clickAtMs: 2_000,
      x: 180,
      y: 320,
    })
  })

  it('errors when the scene markers are missing', () => {
    expect(() => captureSceneWindow({ scene: scene(), actions: [], firstFrameWallMs })).toThrow(
      /marcadores/,
    )
  })

  it('chains zoom keyframes and clamps them into the clip', () => {
    const keyframes = zoomKeyframes({
      clicks: [{ approachAtMs: 1_500, arriveAtMs: 1_820, clickAtMs: 2_000, x: 180, y: 320 }],
      clipDurationMs: 3_500,
    })
    expect(keyframes.map((frame) => frame.scale)).toEqual([1, 1.18, 1.18, 1])
    expect(keyframes[0].atMs).toBe(1_500)
    expect(keyframes[keyframes.length - 1].atMs).toBe(3_400)
  })

  it('keeps the clicked target centered and clamped (never leaves the frame)', () => {
    const keyframes = zoomKeyframes({
      clicks: [{ approachAtMs: 1_500, arriveAtMs: 1_820, clickAtMs: 2_000, x: 180, y: 320 }],
      clipDurationMs: 2_500,
    })
    const zoom = buildZoomExpressions({ keyframes, clipDurationMs: 2_500, viewportWidth: 360 })
    expect(zoom).not.toBeNull()
    expect(zoom!.z).toContain('1.18')
    expect(zoom!.z).toContain('if(lt(on,')
    expect(zoom!.x).toContain('if(lt(on,')
    expect(zoom!.y).toContain('if(lt(on,')
    expect(zoom!.inputWidth).toBe(2_160)
    expect(zoom!.inputHeight).toBe(3_840)
  })

  it('returns no zoom when every keyframe is 1', () => {
    const zoom = buildZoomExpressions({
      keyframes: [
        { atMs: 0, scale: 1, x: null, y: null },
        { atMs: 500, scale: 1, x: null, y: null },
      ],
      clipDurationMs: 1_000,
      viewportWidth: 360,
    })
    expect(zoom).toBeNull()
    expect(piecewiseLinear([{ frame: 0, value: 1 }])).toBe('1')
  })

  it('clamps the caption window inside the clip', () => {
    expect(captionWindow({ clipDurationMs: 3_000, delayMs: 500, durationMs: 2_000 })).toEqual({
      startMs: 500,
      endMs: 2_500,
    })
    expect(captionWindow({ clipDurationMs: 3_000, delayMs: 500 })).toEqual({
      startMs: 500,
      endMs: 3_000,
    })
    expect(captionWindow({ clipDurationMs: 1_000, delayMs: 9_000, durationMs: 500 })).toEqual({
      startMs: 1_000,
      endMs: 1_000,
    })
  })

  it('composes the capture scene plan', () => {
    const plan = captureScenePlan({
      scene: scene({ captionDelayMs: 300, captionDurationMs: 1_500 }),
      actions,
      firstFrameWallMs,
      viewportWidth: 360,
    })
    expect(plan.source).toBe('capture')
    expect(plan.startMs).toBe(1_000)
    expect(plan.durationMs).toBe(2_500)
    expect(plan.zoom).not.toBeNull()
    expect(plan.captions).toEqual([{ startMs: 300, endMs: 1_800 }])
  })

  it('computes the graphic scene window from its own recording', () => {
    expect(
      graphicClipWindow({ readyAtMs: 5_000, firstFrameWallMs: 1_000, durationMs: 2_400 }),
    ).toEqual({ startMs: 4_000, durationMs: 2_400 })
    expect(totalDurationMs([{ durationMs: 2_400 }, { durationMs: 3_200 }])).toBe(5_600)
  })
})
