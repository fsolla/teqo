/**
 * C196 — pure timeline math of the reel: maps the wall-clock action log onto
 * the recorded video timeline, derives the smooth zoom (zoompan expressions)
 * from the click log and places the burned captions inside the Instagram safe
 * area of the design artifact.
 *
 * No browser, no ffmpeg: every function here is deterministic and unit-tested.
 */

/** Physical frame at the CSS viewport scale used by the mobile capture. */
const DEVICE_SCALE = 3

export const REEL = {
  width: 1080,
  height: 1920,
  fps: 30,
  deviceScale: DEVICE_SCALE,
  viewport: { width: 1080 / DEVICE_SCALE, height: 1920 / DEVICE_SCALE },
  /** Design §Safe zone: top ~250px, conservative bottom 672px, sides 6%. */
  safeArea: { topPx: 250, bottomPx: 672, sidePx: 65 },
  /** Design §Legenda: center between 1100–1250px, width ≤900px. */
  caption: { centerYPx: 1160, maxWidthPx: 900 },
  /** Design §Gesto: zoom 108–122% (18%), cursor arrives before, smooth easing. */
  zoom: { scale: 1.18, holdMs: 900, releaseMs: 500 },
  /** zoompan runs on a 2x upscale for subpixel precision (see impl plan). */
  upscale: 2,
}

const round = (value, digits = 4) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

/** Wall clock → video timeline (ms), relative to the first recorded frame. */
export const wallToTimelineMs = (atMs, firstFrameWallMs) => atMs - firstFrameWallMs

const marker = (actions, sceneId, kind) =>
  actions.find((entry) => entry.scene === sceneId && entry.kind === kind) ?? null

/**
 * One capture scene window, in video-timeline ms: from `sceneStart` (setup done,
 * page settled) to `sceneEnd` (after the trailing pause). Clicks carry the
 * approach/arrival/click triple the driver logged.
 *
 * @param {{ scene: { id: string }, actions: Array<{ scene: string, kind: string, at: number, approachAt?: number, arriveAt?: number, x?: number, y?: number, zoom?: boolean }>, firstFrameWallMs: number }} options
 */
export const captureSceneWindow = ({ scene, actions, firstFrameWallMs }) => {
  const start = marker(actions, scene.id, 'sceneStart')
  const end = marker(actions, scene.id, 'sceneEnd')
  if (!start || !end) throw new Error(`Cena "${scene.id}": marcadores de início/fim ausentes.`)
  const at = (wallMs) => wallToTimelineMs(wallMs, firstFrameWallMs)
  const clicks = actions
    .filter((entry) => entry.scene === scene.id && entry.kind === 'click' && entry.zoom !== false)
    .map((entry) => ({
      approachAtMs: at(entry.approachAt),
      arriveAtMs: at(entry.arriveAt),
      clickAtMs: at(entry.at),
      x: entry.x,
      y: entry.y,
    }))
  return {
    id: scene.id,
    startMs: Math.max(0, Math.round(at(start.at))),
    endMs: Math.round(at(end.at)),
    clicks,
  }
}

/**
 * @typedef {{ approachAtMs: number, arriveAtMs: number, clickAtMs: number, x: number, y: number }} ReelClick
 * @typedef {{ atMs: number, scale: number, x: number | null, y: number | null }} ZoomKeyframe
 * @typedef {{ scale: number, holdMs: number, releaseMs: number }} ZoomConfig
 * @typedef {{ z: string, x: string, y: string, inputWidth: number, inputHeight: number }} ZoomExpressions
 */

/**
 * Zoom breakpoints (video-timeline ms) for a scene: ramp to `scale` while the
 * cursor approaches, hold through the click, release back to 1. Multiple
 * clicks chain, and every breakpoint is clamped inside the clip.
 *
 * @param {{ clicks: ReelClick[], clipDurationMs: number, zoom?: ZoomConfig }} options
 * @returns {ZoomKeyframe[]}
 */
export const zoomKeyframes = ({ clicks, clipDurationMs, zoom = REEL.zoom }) => {
  const frames = []
  for (const click of clicks) {
    frames.push({ atMs: click.approachAtMs, scale: 1, x: null, y: null })
    frames.push({ atMs: click.arriveAtMs, scale: zoom.scale, x: click.x, y: click.y })
    frames.push({
      atMs: click.clickAtMs + zoom.holdMs,
      scale: zoom.scale,
      x: click.x,
      y: click.y,
    })
    frames.push({
      atMs: click.clickAtMs + zoom.holdMs + zoom.releaseMs,
      scale: 1,
      x: null,
      y: null,
    })
  }
  const clamped = frames
    .map((frame) => ({ ...frame, atMs: clamp(frame.atMs, 0, clipDurationMs) }))
    .sort((a, b) => a.atMs - b.atMs)
  const deduped = []
  for (const frame of clamped) {
    if (deduped.length > 0 && frame.atMs === deduped[deduped.length - 1].atMs) {
      deduped[deduped.length - 1] = frame
    } else {
      deduped.push(frame)
    }
  }
  return deduped
}

/**
 * Piecewise-linear ffmpeg expression over the output frame number `on`.
 *
 * @param {Array<{ frame: number, value: number }>} points
 * @param {string} [variable]
 * @returns {string}
 */
export const piecewiseLinear = (points, variable = 'on') => {
  if (points.length === 0) return '0'
  let expression = `${round(points[points.length - 1].value)}`
  for (let index = points.length - 1; index > 0; index -= 1) {
    const previous = points[index - 1]
    const current = points[index]
    const span = current.frame - previous.frame
    const segment =
      previous.value === current.value || span === 0
        ? `${round(previous.value)}`
        : `${round(previous.value)}+(${round(current.value)}-${round(previous.value)})*(${variable}-${previous.frame})/${span}`
    expression = `if(lt(${variable},${current.frame}),${segment},${expression})`
  }
  return expression
}

/**
 * ffmpeg `zoompan` expressions for a scene. `z` ramps between the keyframe
 * scales while `x`/`y` keep the clicked target centered (clamped so the crop
 * window never leaves the frame). Returns null when nothing zooms.
 *
 * @param {{ keyframes: ZoomKeyframe[], clipDurationMs: number, viewportWidth: number, width?: number, height?: number, fps?: number }} options
 * @returns {ZoomExpressions | null}
 */
export const buildZoomExpressions = ({
  keyframes,
  clipDurationMs,
  viewportWidth,
  width = REEL.width,
  height = REEL.height,
  fps = REEL.fps,
}) => {
  if (keyframes.length < 2) return null
  const totalFrames = Math.max(1, Math.round((clipDurationMs / 1000) * fps))
  const inputWidth = width * REEL.upscale
  const inputHeight = height * REEL.upscale
  const scale = inputWidth / viewportWidth
  const toFrame = (atMs) => clamp(Math.round((atMs / 1000) * fps), 0, totalFrames)
  const scalePoints = keyframes.map((frame) => ({ frame: toFrame(frame.atMs), value: frame.scale }))
  if (scalePoints.every((point) => point.value === 1)) return null
  const offsetPoints = (axis, size) =>
    keyframes.map((frame) => {
      const target = frame[axis]
      const window = size / frame.scale
      const center = target === null ? size / 2 : target * scale
      const value = clamp(center, window / 2, size - window / 2) - window / 2
      return { frame: toFrame(frame.atMs), value: round(value) }
    })
  // Guard point at frame 0: without it the first segment extrapolates below
  // the zoompan valid range (z >= 1) during the scene lead-in.
  const withStartGuard = (points, value) =>
    points[0].frame === 0 ? points : [{ frame: 0, value }, ...points]
  return {
    z: piecewiseLinear(withStartGuard(scalePoints, 1)),
    x: piecewiseLinear(withStartGuard(offsetPoints('x', inputWidth), 0)),
    y: piecewiseLinear(withStartGuard(offsetPoints('y', inputHeight), 0)),
    inputWidth,
    inputHeight,
  }
}

/**
 * Caption window inside the clip, in ms.
 *
 * @param {{ clipDurationMs: number, delayMs: number, durationMs?: number | null }} options
 * @returns {{ startMs: number, endMs: number }}
 */
export const captionWindow = ({ clipDurationMs, delayMs, durationMs = null }) => {
  const startMs = clamp(delayMs, 0, clipDurationMs)
  const endMs =
    durationMs === null ? clipDurationMs : clamp(startMs + durationMs, startMs, clipDurationMs)
  return { startMs, endMs }
}

/**
 * Full capture-scene plan consumed by the composer: clip window, zoom
 * expressions and the burned caption window (all relative to the clip).
 *
 * @param {{ scene: { id: string, caption: unknown, captionDelayMs: number, captionDurationMs: number | null }, actions: Array<{ scene: string, kind: string, at: number, approachAt?: number, arriveAt?: number, x?: number, y?: number, zoom?: boolean }>, firstFrameWallMs: number, viewportWidth?: number, zoom?: ZoomConfig }} options
 * @returns {{ id: string, source: string, startMs: number, durationMs: number, zoom: ZoomExpressions | null, captions: Array<{ startMs: number, endMs: number }> }}
 */
export const captureScenePlan = ({
  scene,
  actions,
  firstFrameWallMs,
  viewportWidth = 360,
  zoom = REEL.zoom,
}) => {
  const window = captureSceneWindow({ scene, actions, firstFrameWallMs })
  const clipDurationMs = Math.max(1, window.endMs - window.startMs)
  const keyframes = zoomKeyframes({ clicks: window.clicks, clipDurationMs, zoom })
  const zoomExpressions = buildZoomExpressions({
    keyframes,
    clipDurationMs,
    viewportWidth,
  })
  const caps = scene.caption
    ? [
        captionWindow({
          clipDurationMs,
          delayMs: scene.captionDelayMs,
          durationMs: scene.captionDurationMs,
        }),
      ]
    : []
  return {
    id: scene.id,
    source: 'capture',
    startMs: window.startMs,
    durationMs: clipDurationMs,
    zoom: zoomExpressions,
    captions: caps,
  }
}

/**
 * Window of a graphic scene recording (hook/CTA): from `readyAt`, fixed span.
 *
 * @param {{ readyAtMs: number, firstFrameWallMs: number, durationMs: number }} options
 * @returns {{ startMs: number, durationMs: number }}
 */
export const graphicClipWindow = ({ readyAtMs, firstFrameWallMs, durationMs }) => {
  const startMs = Math.max(0, Math.round(readyAtMs - firstFrameWallMs))
  return { startMs, durationMs }
}

/**
 * Plan of a graphic scene (hook/CTA): its own recording, fixed duration and no
 * zoom/captions (the template carries the motion and the copy).
 *
 * @param {{ scene: { id: string, durationMs: number }, readyAtMs: number, firstFrameWallMs: number }} options
 * @returns {{ id: string, source: string, startMs: number, durationMs: number, zoom: null, captions: never[] }}
 */
export const graphicScenePlan = ({ scene, readyAtMs, firstFrameWallMs }) => {
  const window = graphicClipWindow({ readyAtMs, firstFrameWallMs, durationMs: scene.durationMs })
  return {
    id: scene.id,
    source: 'graphic',
    startMs: window.startMs,
    durationMs: window.durationMs,
    zoom: null,
    captions: [],
  }
}

/**
 * @param {Array<{ durationMs: number }>} plans
 * @returns {number}
 */
export const totalDurationMs = (plans) => plans.reduce((sum, plan) => sum + plan.durationMs, 0)

export const seconds = (ms) => round(ms / 1000, 3)
