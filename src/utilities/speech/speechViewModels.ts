/**
 * Speech acervo view models (C154). Pure: the loader hands raw Payload rows
 * and the view model decides labels, the matching excerpt and the links the
 * list/detail render.
 */
import { CAMPAIGN_COMMUNICATION_ACERVO } from '@/lib/campaignPaths'
import { formatSpeechClock, formatSpeechDate, formatSpeechSpan } from '@/lib/speechClock'
import type { SpeechCutSummaryViewModel } from '@/lib/speechCut'
import type { SpeechExcerptSegment } from '@/lib/speechExcerpt'
import type { SpeechScope, SpeechTopic } from '@/lib/speechFacets'
import {
  buildHighlightedExcerpt,
  matchesSearchTerms,
  speechSearchTerms,
  splitHighlightedParts,
  type SpeechHighlightedExcerpt,
  type SpeechHighlightPart,
} from '@/lib/speechHighlight'
import { normalizeForSearch, speechMatchesSearchQuery } from '@/lib/speechSearch'
import {
  excerptOffsetSeconds,
  parseYoutubeVideoId,
  speechVodCoordinates,
  youtubeThumbnailUrl,
} from '@/lib/speechVod'
import type { Municipality } from '@/payload-types'
import { speechScopeLabels, speechTopicLabels } from '@/utilities/speech/speechListUrl'

/** ASR segment shape, owned by the C158 excerpt builder (`lib/speechExcerpt`). */
export type SpeechSegmentRecord = SpeechExcerptSegment

export type SpeechListRecord = {
  id: number
  speechAt: string
  type?: string | null
  durationSeconds?: number | null
  summary?: string | null
  officialTranscript?: string | null
  keywords?: string[] | null
  topics?: SpeechTopic[] | null
  scopes?: SpeechScope[] | null
  mentionedMunicipalities?: (number | Municipality)[] | null
  presidingOfficer?: string | null
  officialTextUrl?: string | null
  youtubeUrl?: string | null
  /** C174 — normalized search text; lets the row tell whether it matched `q`. */
  searchText?: string | null
}

type SpeechListMatchKind = 'segment' | 'keyword' | 'fallback'

export type SpeechListItemViewModel = {
  id: number
  speechAtLabel: string
  type: string | null
  durationLabel: string | null
  presidingOfficer: string | null
  excerpt: SpeechHighlightedExcerpt
  matchKind: SpeechListMatchKind
  topics: { value: SpeechTopic; label: string }[]
  scopes: { value: SpeechScope; label: string }[]
  keywords: string[]
  municipalities: { id: number; name: string }[]
  /** YouTube cover of the session link (C175); null when the speech has none. */
  thumbnailUrl: string | null
  watchHref: string
  sourceUrl: string | null
  /** C174 — the cuts already made from this speech, newest first. */
  cuts: SpeechCutSummaryViewModel[]
  /**
   * C174 — false when the speech surfaced only because one of its cuts matched
   * the term; the card then swaps the excerpt for the honest origin note.
   */
  matchedTextSearch: boolean
}

export type SpeechDetailSegmentViewModel = {
  startSeconds: number
  endSeconds: number
  startLabel: string
  parts: SpeechHighlightPart[]
}

export type SpeechDetailViewModel = {
  id: number
  speechAtLabel: string
  /** Day-only label (`dd/mm/aaaa`) for the share message. */
  speechDateLabel: string
  type: string | null
  phase: string | null
  durationLabel: string | null
  /** Raw duration for the C166 excerpt picker; null when the row has none. */
  durationSeconds: number | null
  presidingOfficer: string | null
  summary: string | null
  officialTranscript: string | null
  officialTextUrl: string | null
  youtubeUrl: string | null
  keywords: string[]
  topics: { value: SpeechTopic; label: string }[]
  scopes: { value: SpeechScope; label: string }[]
  municipalities: { id: number; name: string }[]
  segments: SpeechDetailSegmentViewModel[]
  /** YouTube default source (C162): id when the session link parses, else null. */
  youtubeVideoId: string | null
  /** Session offset in seconds (excerpt epoch − session start), null when unknowable. */
  youtubeOffsetSeconds: number | null
  /** Stored VOD + excerpt coordinates — the Câmara may be asked on click. */
  vodResolvable: boolean
}

/**
 * `speechAt` is the Câmara wall-clock string ("2026-08-11T18:48", no timezone);
 * slicing it keeps the local reading and avoids a `Date` shifting it.
 */
export const formatSpeechAt = (speechAt: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(speechAt)
  if (!match) return speechAt
  const [, year, month, day, hour, minute] = match
  return `${day}/${month}/${year} · ${hour}:${minute}`
}

const formatSpeechDuration = (seconds: number | null | undefined): string | null =>
  seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0
    ? null
    : formatSpeechSpan(seconds)

type MunicipalityMentions = {
  mentionedMunicipalities?: (number | Municipality)[] | null
}

/** Cited municipality ids from a speech row (depth 0 keeps them as numbers). */
export const municipalityIdsOfSpeech = (speech: MunicipalityMentions): number[] =>
  (speech.mentionedMunicipalities ?? []).flatMap((value) =>
    typeof value === 'number' ? [value] : [value.id],
  )

const municipalityViewModels = (
  speech: SpeechListRecord,
  labels: ReadonlyMap<number, string>,
): { id: number; name: string }[] =>
  (speech.mentionedMunicipalities ?? []).flatMap((value) => {
    if (typeof value !== 'number') return [{ id: value.id, name: value.name }]
    const name = labels.get(value)
    return name ? [{ id: value, name }] : []
  })

const topicViewModels = (speech: SpeechListRecord) =>
  (speech.topics ?? []).map((value) => ({ value, label: speechTopicLabels[value] }))

const scopeViewModels = (speech: SpeechListRecord) =>
  (speech.scopes ?? []).map((value) => ({ value, label: speechScopeLabels[value] }))

const pickMatchingSegment = (
  segments: readonly SpeechSegmentRecord[],
  query: string | undefined,
): SpeechSegmentRecord | undefined => {
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

export const buildWatchHref = (
  speechId: number,
  segment: SpeechSegmentRecord | undefined,
  query: string | undefined,
): string => {
  const params = new URLSearchParams()
  // ASR timestamps are fractional seconds; the URL carries whole seconds.
  if (segment) params.set('t', String(Math.max(0, Math.floor(segment.startSeconds))))
  if (query) params.set('q', query)
  const queryString = params.toString()
  return `${CAMPAIGN_COMMUNICATION_ACERVO}/${speechId}${queryString ? `?${queryString}` : ''}`
}

/** Seek offset from the detail URL (`?t=`), non-negative seconds or null. */
export const parseSpeechSeekSeconds = (raw: string | undefined): number | null => {
  if (raw === undefined) return null
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
}

type SpeechCuts = readonly SpeechCutSummaryViewModel[]

export const toSpeechListItemViewModel = ({
  speech,
  segments,
  query,
  municipalityLabels,
  cuts = [],
}: {
  speech: SpeechListRecord
  segments: readonly SpeechSegmentRecord[]
  query?: string
  municipalityLabels: ReadonlyMap<number, string>
  /** C174 — the cuts of this speech, nested in the result card. */
  cuts?: SpeechCuts
}): SpeechListItemViewModel => {
  const matchedSegment = pickMatchingSegment(segments, query)
  const q = query?.trim()
  const normalizedQuery = q ? normalizeForSearch(q) : ''
  const keywordMatch =
    !matchedSegment &&
    Boolean(normalizedQuery) &&
    (speech.keywords ?? []).some((keyword) => normalizeForSearch(keyword).includes(normalizedQuery))

  const excerptSource =
    matchedSegment?.text ?? segments[0]?.text ?? speech.summary ?? speech.officialTranscript ?? ''

  return {
    id: speech.id,
    speechAtLabel: formatSpeechAt(speech.speechAt),
    type: speech.type ?? null,
    durationLabel: formatSpeechDuration(speech.durationSeconds),
    presidingOfficer: speech.presidingOfficer ?? null,
    excerpt: buildHighlightedExcerpt(excerptSource, q ?? ''),
    matchKind: matchedSegment ? 'segment' : keywordMatch ? 'keyword' : 'fallback',
    topics: topicViewModels(speech),
    scopes: scopeViewModels(speech),
    keywords: speech.keywords ?? [],
    municipalities: municipalityViewModels(speech, municipalityLabels),
    thumbnailUrl: youtubeThumbnailUrl(parseYoutubeVideoId(speech.youtubeUrl)),
    watchHref: buildWatchHref(speech.id, matchedSegment, q),
    sourceUrl: speech.officialTextUrl ?? speech.youtubeUrl ?? null,
    cuts: [...cuts],
    matchedTextSearch: speechMatchesSearchQuery(speech, query),
  }
}

export type SpeechDetailRecord = SpeechListRecord & {
  phase?: string | null
  vodPlaybackUrl?: string | null
  vodDownloadUrl?: string | null
  eventId?: number | null
  audioId?: number | null
  excerptTMs?: number | null
  eventStartAt?: string | null
}

export const toSpeechDetailViewModel = ({
  speech,
  segments,
  query,
  municipalityLabels,
}: {
  speech: SpeechDetailRecord
  segments: readonly SpeechSegmentRecord[]
  query?: string
  municipalityLabels: ReadonlyMap<number, string>
}): SpeechDetailViewModel => {
  // The stored VOD link is a cache and never a URL handed to the client; it
  // only signals that this record had a generated excerpt to re-resolve.
  const vodResolvable = speechVodCoordinates(speech) !== null

  return {
    id: speech.id,
    speechAtLabel: formatSpeechAt(speech.speechAt),
    speechDateLabel: formatSpeechDate(speech.speechAt),
    type: speech.type ?? null,
    phase: speech.phase ?? null,
    durationLabel: formatSpeechDuration(speech.durationSeconds),
    durationSeconds: speech.durationSeconds ?? null,
    presidingOfficer: speech.presidingOfficer ?? null,
    summary: speech.summary ?? null,
    officialTranscript: speech.officialTranscript ?? null,
    officialTextUrl: speech.officialTextUrl ?? null,
    youtubeUrl: speech.youtubeUrl ?? null,
    keywords: speech.keywords ?? [],
    topics: topicViewModels(speech),
    scopes: scopeViewModels(speech),
    municipalities: municipalityViewModels(speech, municipalityLabels),
    segments: segments.map((segment) => ({
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      startLabel: formatSpeechClock(segment.startSeconds),
      parts: splitHighlightedParts(segment.text, query ?? ''),
    })),
    youtubeVideoId: parseYoutubeVideoId(speech.youtubeUrl),
    youtubeOffsetSeconds: excerptOffsetSeconds(speech.excerptTMs, speech.eventStartAt),
    vodResolvable,
  }
}
