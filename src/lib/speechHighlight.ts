import { normalizeForSearch } from '@/lib/speechSearch'

/**
 * C154 — term highlighting for the speech acervo. The search normalizes text
 * (NFD strips accents, lowercase) so "saude" matches "saúde"; highlighting has
 * to map those matches back to the ORIGINAL spelling, which means the
 * normalized string cannot be searched with `indexOf` on the source text.
 *
 * `buildNormalizedIndex` normalizes character by character while recording, for
 * each normalized character, the source index it came from — so a range in the
 * normalized space converts to a source range. Pure and unit-tested.
 */

export type SpeechHighlightPart = {
  text: string
  highlighted: boolean
}

export type SpeechHighlightedExcerpt = {
  parts: SpeechHighlightPart[]
  truncatedStart: boolean
  truncatedEnd: boolean
}

export type SpeechHighlightRange = {
  start: number
  end: number
}

type NormalizedIndex = {
  normalized: string
  /** `sourceIndex[i]` is the original text index that produced `normalized[i]`. */
  sourceIndex: number[]
}

const buildNormalizedIndex = (text: string): NormalizedIndex => {
  const chars: string[] = []
  const sourceIndex: number[] = []
  let pendingSpace = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!
    if (/\s/.test(char)) {
      if (chars.length > 0) pendingSpace = true
      continue
    }
    const piece = normalizeForSearch(char)
    if (piece === '') continue
    if (pendingSpace) {
      chars.push(' ')
      sourceIndex.push(index)
      pendingSpace = false
    }
    for (const pieceChar of piece) {
      chars.push(pieceChar)
      sourceIndex.push(index)
    }
  }

  return { normalized: chars.join(''), sourceIndex }
}

/** Normalized search terms (words) of the query, in order, duplicates kept out. */
const speechSearchTerms = (query: string): string[] => [
  ...new Set(
    normalizeForSearch(query)
      .split(' ')
      .filter((term) => term.length > 0),
  ),
]

/** True when every query term occurs somewhere in the text (accent-insensitive). */
export const matchesSearchTerms = (text: string, query: string): boolean => {
  const terms = speechSearchTerms(query)
  if (terms.length === 0) return false
  const { normalized } = buildNormalizedIndex(text)
  return terms.every((term) => normalized.includes(term))
}

/** Any record carrying the searchable text of one segment (speech/recording). */
export type SearchableSegment = { text: string }

/**
 * C154/C199 — the first segment that carries the whole query (all terms, any
 * order), else the first one carrying any term. Shared by the speech acervo and
 * the uploaded recordings, which pick the excerpt of a result the same way.
 */
export const pickMatchingSegment = <Segment extends SearchableSegment>(
  segments: readonly Segment[],
  query: string | undefined,
): Segment | undefined => {
  const q = query?.trim()
  if (!q || segments.length === 0) return undefined
  const allTerms = segments.find((segment) => matchesSearchTerms(segment.text, q))
  if (allTerms) return allTerms
  const terms = speechSearchTerms(q)
  return segments.find((segment) => {
    const normalized = normalizeForSearch(segment.text)
    return terms.some((term) => normalized.includes(term))
  })
}

/** Every occurrence of every term, mapped back to source offsets and merged. */
export const findHighlightRanges = (text: string, query: string): SpeechHighlightRange[] => {
  const terms = speechSearchTerms(query)
  if (terms.length === 0 || text.length === 0) return []

  const { normalized, sourceIndex } = buildNormalizedIndex(text)
  if (normalized.length === 0) return []

  const ranges: SpeechHighlightRange[] = []
  for (const term of terms) {
    let from = 0
    while (from <= normalized.length - term.length) {
      const at = normalized.indexOf(term, from)
      if (at === -1) break
      ranges.push({
        start: sourceIndex[at]!,
        end: sourceIndex[at + term.length - 1]! + 1,
      })
      // Overlapping occurrences ("ana" in "banana") are found one step at a time.
      from = at + 1
    }
  }

  return mergeHighlightRanges(ranges)
}

/**
 * C192 — every occurrence of the whole normalized PHRASE as a single range, so
 * a theme match like "acesso universal à saúde" is one continuous band (the
 * per-term search would drop the "à" and split the band). Falls back to the
 * per-term ranges when the phrase does not occur contiguously.
 */
export const findPhraseRanges = (text: string, phrase: string): SpeechHighlightRange[] => {
  const needle = normalizeForSearch(phrase)
  if (!needle || text.length === 0) return []

  const { normalized, sourceIndex } = buildNormalizedIndex(text)
  if (normalized.length === 0) return []

  const ranges: SpeechHighlightRange[] = []
  let from = 0
  while (from <= normalized.length - needle.length) {
    const at = normalized.indexOf(needle, from)
    if (at === -1) break
    ranges.push({
      start: sourceIndex[at]!,
      end: sourceIndex[at + needle.length - 1]! + 1,
    })
    from = at + 1
  }

  return ranges.length > 0 ? mergeHighlightRanges(ranges) : findHighlightRanges(text, phrase)
}

const mergeHighlightRanges = (ranges: readonly SpeechHighlightRange[]): SpeechHighlightRange[] => {
  const sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end)
  const merged: SpeechHighlightRange[] = []
  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      if (range.end > last.end) last.end = range.end
      continue
    }
    merged.push({ ...range })
  }
  return merged
}

const partsFromRanges = (
  text: string,
  ranges: readonly SpeechHighlightRange[],
): SpeechHighlightPart[] => {
  const parts: SpeechHighlightPart[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push({ text: text.slice(cursor, range.start), highlighted: false })
    }
    parts.push({ text: text.slice(range.start, range.end), highlighted: true })
    cursor = Math.max(cursor, range.end)
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlighted: false })
  return parts
}

/** All matches of the query highlighted, no windowing — the detail transcript. */
export const splitHighlightedParts = (text: string, query: string): SpeechHighlightPart[] =>
  partsFromRanges(text, findHighlightRanges(text, query))

/**
 * A readable window around the first match (or the text start when there is
 * none), with the matched terms highlighted and truncation flags for the
 * ellipses the card renders.
 */
export const buildHighlightedExcerpt = (
  text: string,
  query: string,
  { radius = 160, phrase = false }: { radius?: number; phrase?: boolean } = {},
): SpeechHighlightedExcerpt => {
  const trimmed = text.trim()
  if (trimmed === '') return { parts: [], truncatedStart: false, truncatedEnd: false }

  const ranges = phrase ? findPhraseRanges(trimmed, query) : findHighlightRanges(trimmed, query)
  const focus = ranges[0]
  const windowStart = focus ? Math.max(0, focus.start - radius) : 0
  const windowEnd = focus
    ? Math.min(trimmed.length, focus.end + radius)
    : Math.min(trimmed.length, radius * 2)

  const windowed = ranges
    .filter((range) => range.end > windowStart && range.start < windowEnd)
    .map((range) => ({
      start: Math.max(0, range.start - windowStart),
      end: Math.min(windowEnd - windowStart, range.end - windowStart),
    }))

  return {
    parts: partsFromRanges(trimmed.slice(windowStart, windowEnd), windowed),
    truncatedStart: windowStart > 0,
    truncatedEnd: windowEnd < trimmed.length,
  }
}
