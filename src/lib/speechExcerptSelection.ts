/**
 * C166 — pure geometry for the acervo excerpt picker: whole-second
 * [start, end] ranges snapped to transcript segment boundaries, clamped to the
 * 5 s minimum and to the speech duration (C170: no upper cap — the speech
 * itself is the limit). No DOM and no React:
 * the client controls only translate pointers/keys into these calls.
 */

/**
 * C174 — the empty-state CTA of "Cortes desta fala" lives outside the player
 * but must turn the picker on. The player owns the selection state, so the CTA
 * only announces the intent on `window`; the name lives here (client-safe, no
 * DOM) so the two ends cannot drift into a silent no-op.
 */
export const SPEECH_EXCERPT_REQUEST_EVENT = 'speech:excerpt-request'

export type ExcerptSegment = {
  startSeconds: number
  endSeconds: number
}

export type ExcerptRange = {
  startSeconds: number
  endSeconds: number
}

export type ExcerptEdge = 'start' | 'end'

/** C173 — the presentation phase of the excerpt preview, shared by the player and the card. */
export type ExcerptPreviewPhase = 'idle' | 'playing' | 'ended'

export const MIN_EXCERPT_SECONDS = 5

/**
 * C174 — the duration the picker can work with: the stored duration, falling
 * back to the last transcript segment's end. Single owner of the rule so the
 * player and the empty "Cortes desta fala" block agree on availability.
 */
export const excerptSelectionDuration = (
  durationSeconds: number | null | undefined,
  segments: readonly ExcerptSegment[],
): number | null => durationSeconds ?? segments.at(-1)?.endSeconds ?? null

/** Whether the picker is offered at all (the speech holds the 5 s minimum). */
export const isExcerptSelectionAvailable = (
  durationSeconds: number | null | undefined,
  segments: readonly ExcerptSegment[],
): boolean => {
  const duration = excerptSelectionDuration(durationSeconds, segments)
  return duration !== null && duration >= MIN_EXCERPT_SECONDS
}

export const rangeDurationSeconds = (range: ExcerptRange): number =>
  range.endSeconds - range.startSeconds

/**
 * C217 — whether a transcript segment is inside the picked window. Shared by
 * the Câmara and the web players so the marked phrases can never disagree
 * (ASR timestamps are fractional; the overlap is strict on both edges).
 */
export const segmentInExcerpt = (segment: ExcerptSegment, range: ExcerptRange): boolean =>
  segment.endSeconds > range.startSeconds && segment.startSeconds < range.endSeconds

/**
 * C173 — the stop target of the excerpt preview: the range end once
 * `currentSeconds` reaches it (inclusive). The `<video>` `timeupdate` fires at
 * ~4 Hz and can overshoot, so the returned value is what the player clamps back
 * to before pausing. Null while the playhead is still inside the window. Pure
 * and DOM-free — the rule is testable without a player, like the picker geometry.
 */
export const excerptPreviewStopAt = (range: ExcerptRange, currentSeconds: number): number | null =>
  Number.isFinite(currentSeconds) && currentSeconds >= range.endSeconds ? range.endSeconds : null

const durationFloor = (durationSeconds: number): number =>
  Number.isFinite(durationSeconds) ? Math.max(0, Math.floor(durationSeconds)) : 0

const wholeFloor = (seconds: number): number => (Number.isFinite(seconds) ? Math.floor(seconds) : 0)
const wholeCeil = (seconds: number): number => (Number.isFinite(seconds) ? Math.ceil(seconds) : 0)

/**
 * Clamp a raw [start, end] pair into a valid excerpt range: whole seconds,
 * inside [0, duration], at least 5 s long (a short pair
 * grows forward, and backwards when the speech ends first). Returns null when
 * the duration cannot hold the minimum — the caller then hides the picker.
 */
export const normalizeExcerptRange = (
  rawStart: number,
  rawEnd: number,
  durationSeconds: number,
): ExcerptRange | null => {
  const duration = durationFloor(durationSeconds)
  if (duration < MIN_EXCERPT_SECONDS) return null

  let start = Math.min(Math.max(0, wholeFloor(rawStart)), duration - MIN_EXCERPT_SECONDS)
  let end = Math.min(Math.max(0, wholeCeil(rawEnd)), duration)

  if (end < start) [start, end] = [end, start]
  if (end - start < MIN_EXCERPT_SECONDS) {
    end = Math.min(duration, start + MIN_EXCERPT_SECONDS)
    start = Math.max(0, end - MIN_EXCERPT_SECONDS)
  }

  return { startSeconds: start, endSeconds: end }
}

/** The picked phrase as the initial range (or the first 5 s when there is no ASR). */
export const initialExcerptRange = (
  segments: readonly ExcerptSegment[],
  durationSeconds: number,
): ExcerptRange | null =>
  segments.length > 0
    ? selectSegmentRange(segments, 0, durationSeconds)
    : normalizeExcerptRange(0, MIN_EXCERPT_SECONDS, durationSeconds)

/** A whole phrase, clamped by the duration and by the 5 s minimum. */
export const selectSegmentRange = (
  segments: readonly ExcerptSegment[],
  index: number,
  durationSeconds: number,
): ExcerptRange | null => {
  const segment = segments[index]
  if (!segment) return null
  return normalizeExcerptRange(segment.startSeconds, segment.endSeconds, durationSeconds)
}

/**
 * Adjacent ASR phrases share a fractional boundary (one ends at 50.1 and the
 * next starts at 50.1): a click whose edge lands this close to the current
 * range edge is the neighbour phrase, not an overlap. Without it, selecting
 * the next phrase right after the current one would re-select instead of
 * extending.
 */
const ADJACENT_PHRASE_EPSILON_SECONDS = 1

/**
 * Phrase click in selection mode: a phrase after the range extends the end, a
 * phrase before it moves the start back, and a phrase already inside the range
 * re-selects that phrase alone. Segment seconds are fractional (ASR), so the
 * start floors and the end ceils while clamping.
 */
export const extendRangeToSegment = (
  range: ExcerptRange,
  segments: readonly ExcerptSegment[],
  index: number,
  durationSeconds: number,
): ExcerptRange | null => {
  const segment = segments[index]
  if (!segment) return range
  if (segment.endSeconds <= range.startSeconds + ADJACENT_PHRASE_EPSILON_SECONDS) {
    return normalizeExcerptRange(segment.startSeconds, range.endSeconds, durationSeconds)
  }
  if (segment.startSeconds >= range.endSeconds - ADJACENT_PHRASE_EPSILON_SECONDS) {
    return normalizeExcerptRange(range.startSeconds, segment.endSeconds, durationSeconds)
  }
  return selectSegmentRange(segments, index, durationSeconds)
}

/**
 * Handle/keyboard move of one edge: the other edge stays put, the span stays
 * at least 5 s, and the range stays inside the speech (C170: no upper cap).
 */
export const moveRangeEdge = (
  range: ExcerptRange,
  edge: ExcerptEdge,
  nextSeconds: number,
  durationSeconds: number,
): ExcerptRange => {
  const duration = durationFloor(durationSeconds)
  const requested = Math.round(Number.isFinite(nextSeconds) ? nextSeconds : 0)

  if (edge === 'start') {
    const maximum = range.endSeconds - MIN_EXCERPT_SECONDS
    return {
      startSeconds: Math.min(Math.max(requested, 0), maximum),
      endSeconds: range.endSeconds,
    }
  }

  const minimum = range.startSeconds + MIN_EXCERPT_SECONDS
  const maximum = duration
  return {
    startSeconds: range.startSeconds,
    endSeconds: Math.min(Math.max(requested, minimum), maximum),
  }
}

/** Pointer ratio on the track (0..1) → whole seconds inside the speech. */
export const secondsFromTrackRatio = (ratio: number, durationSeconds: number): number => {
  const clamped = Math.min(Math.max(Number.isFinite(ratio) ? ratio : 0, 0), 1)
  return Math.round(clamped * durationFloor(durationSeconds))
}

/** Segment boundaries as whole seconds, ascending — the magnet targets of the handles. */
export const segmentBoundarySeconds = (segments: readonly ExcerptSegment[]): number[] =>
  [
    ...new Set(
      segments.flatMap((segment) => [
        wholeFloor(segment.startSeconds),
        wholeCeil(segment.endSeconds),
      ]),
    ),
  ].sort((left, right) => left - right)

/** Snap to the nearest segment boundary within the tolerance (px converted to seconds). */
export const snapSecondsToSegmentBoundary = (
  seconds: number,
  segments: readonly ExcerptSegment[],
  toleranceSeconds: number,
): number => {
  let best = seconds
  let bestDistance = toleranceSeconds
  for (const boundary of segmentBoundarySeconds(segments)) {
    const distance = Math.abs(boundary - seconds)
    if (distance <= bestDistance) {
      best = boundary
      bestDistance = distance
    }
  }
  return best
}
