import { normalizeForSearch } from '@/lib/speechSearch'

/**
 * C158 — continuous speech excerpt builder for the Sollinha suggestion tool.
 * Pure: given the ASR segments of ONE speech and the sanitized search terms,
 * pick the segment with the best term coverage and expand it into a
 * contiguous window (consecutive segments only) that contains every term.
 * The timestamps come straight from the ASR — a model never invents them.
 */

export type SpeechExcerptSegment = {
  startSeconds: number
  endSeconds: number
  text: string
}

export type SpeechExcerpt = {
  startSeconds: number
  endSeconds: number
  text: string
  /** Every requested term is present in `text` (that is the acceptance rule). */
  matchedTerms: string[]
}

const MIN_TERM_LENGTH = 3
const MAX_TERMS = 6
const EXCERPT_MIN_SECONDS = 15
const EXCERPT_DEFAULT_TARGET_SECONDS = 30
const EXCERPT_MAX_SECONDS = 60
const EXCERPT_MAX_GAP_SECONDS = 5
const EXCERPT_MAX_ANCHORS = 5
/** Short/long variants offered to the C158 reranker ("de que ponto a que ponto"). */
export const EXCERPT_VARIANT_TARGETS = [20, 45] as const

/**
 * Search terms of a spoken theme: accent-folded, split on anything that is not
 * a letter or digit (so `%`/`_` never reach the SQL `LIKE`), deduped, short
 * terms dropped (the trigram index needs 3+ chars) and capped.
 */
export const speechExcerptTerms = (query: string): string[] => {
  const terms: string[] = []
  for (const term of normalizeForSearch(query).split(/[^a-z0-9]+/)) {
    if (term.length < MIN_TERM_LENGTH || terms.includes(term)) continue
    terms.push(term)
    if (terms.length >= MAX_TERMS) break
  }
  return terms
}

const windowDuration = (
  segments: readonly SpeechExcerptSegment[],
  from: number,
  to: number,
): number => segments[to]!.endSeconds - segments[from]!.startSeconds

const canExtendForward = (
  segments: readonly SpeechExcerptSegment[],
  from: number,
  to: number,
): boolean => {
  const next = segments[to + 1]
  if (!next) return false
  if (next.startSeconds - segments[to]!.endSeconds > EXCERPT_MAX_GAP_SECONDS) return false
  // A single segment longer than the cap is returned whole (never cut mid-segment).
  return windowDuration(segments, from, to + 1) <= EXCERPT_MAX_SECONDS
}

const canExtendBackward = (
  segments: readonly SpeechExcerptSegment[],
  from: number,
  to: number,
): boolean => {
  const previous = segments[from - 1]
  if (!previous) return false
  if (segments[from]!.startSeconds - previous.endSeconds > EXCERPT_MAX_GAP_SECONDS) return false
  return windowDuration(segments, from - 1, to) <= EXCERPT_MAX_SECONDS
}

const windowText = (segments: readonly SpeechExcerptSegment[], from: number, to: number): string =>
  segments
    .slice(from, to + 1)
    .map((segment) => segment.text.trim())
    .filter((part) => part.length > 0)
    .join(' ')

const windowCovers = (text: string, terms: readonly string[]): boolean => {
  const normalized = normalizeForSearch(text)
  return terms.every((term) => normalized.includes(term))
}

const expandWindow = (
  segments: readonly SpeechExcerptSegment[],
  anchorIndex: number,
  terms: readonly string[],
  targetSeconds: number,
): { from: number; to: number } => {
  let from = anchorIndex
  let to = anchorIndex

  // Coverage first, target as the comfort size: keep growing while a term is
  // missing or the window is still shorter than the target.
  while (
    canExtendForward(segments, from, to) &&
    (!windowCovers(windowText(segments, from, to), terms) ||
      windowDuration(segments, from, to) < targetSeconds)
  ) {
    to += 1
  }
  while (
    canExtendBackward(segments, from, to) &&
    (!windowCovers(windowText(segments, from, to), terms) ||
      windowDuration(segments, from, to) < EXCERPT_MIN_SECONDS)
  ) {
    from -= 1
  }

  return { from, to }
}

/**
 * Best contiguous excerpt for the terms, or `null` when no window of up to
 * `EXCERPT_MAX_SECONDS` (single long segment included) carries every term.
 * `targetSeconds` sizes the window: the short/long variants are two calls.
 */
export const buildSpeechExcerpt = (
  segments: readonly SpeechExcerptSegment[],
  terms: readonly string[],
  { targetSeconds = EXCERPT_DEFAULT_TARGET_SECONDS }: { targetSeconds?: number } = {},
): SpeechExcerpt | null => {
  if (segments.length === 0 || terms.length === 0) return null

  const normalizedSegments = segments.map((segment) => normalizeForSearch(segment.text))

  const anchors = segments
    .map((_, index) => ({
      index,
      coverage: terms.filter((term) => normalizedSegments[index]!.includes(term)).length,
    }))
    .filter(({ coverage }) => coverage > 0)
    .sort((left, right) => right.coverage - left.coverage || left.index - right.index)
    .slice(0, EXCERPT_MAX_ANCHORS)

  for (const { index } of anchors) {
    const { from, to } = expandWindow(segments, index, terms, targetSeconds)
    const text = windowText(segments, from, to)
    if (!windowCovers(text, terms)) continue

    return {
      startSeconds: segments[from]!.startSeconds,
      endSeconds: segments[to]!.endSeconds,
      text,
      matchedTerms: [...terms],
    }
  }

  return null
}
