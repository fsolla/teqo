/**
 * Speech acervo view models (C154). Pure: the loader hands raw Payload rows
 * and the view model decides labels, the matching excerpt and the links the
 * list/detail render.
 */
import {
  CAMPAIGN_COMMUNICATION_ACERVO,
  campaignInternetSpeechCoverHref,
  campaignInternetSpeechFileHref,
  campaignInternetSpeechHref,
} from '@/lib/campaignPaths'
import { relationshipId } from '@/lib/relationship'
import { formatSpeechClock, formatSpeechDate, formatSpeechSpan } from '@/lib/speechClock'
import type { SpeechCutSummaryViewModel } from '@/lib/speechCut'
import type { SpeechExcerptSegment } from '@/lib/speechExcerpt'
import type { SpeechScope, SpeechTopic } from '@/lib/speechFacets'
import {
  buildHighlightedExcerpt,
  pickMatchingSegment,
  splitHighlightedParts,
  type SpeechHighlightedExcerpt,
  type SpeechHighlightPart,
} from '@/lib/speechHighlight'
import { speechPosterHref, speechPosterTarget } from '@/lib/speechPoster'
import { normalizeForSearch, speechMatchesSearchQuery } from '@/lib/speechSearch'
import {
  correctedExcerptOffsetSeconds,
  excerptOffsetSeconds,
  measuredVideoLagSeconds,
  parseYoutubeVideoId,
  sessionLagSeconds,
  speechCoverUrl,
  speechVodCoordinates,
} from '@/lib/speechVod'
import {
  webSpeechDisplayTitle,
  webSpeechMediaKind,
  webSpeechPlatformLabel,
  type WebSpeechPlatform,
} from '@/lib/webSpeech'
import type { Municipality } from '@/payload-types'
import { speechScopeLabels, speechTopicLabels } from '@/utilities/speech/speechListUrl'

/** ASR segment shape, owned by the C158 excerpt builder (`lib/speechExcerpt`). */
export type SpeechSegmentRecord = SpeechExcerptSegment

/**
 * C229 — the segment plus its stored `order`, so the semantic evidence reader
 * can resolve the index row back to the real passage text.
 */
export type SpeechSegmentRecordWithOrder = SpeechSegmentRecord & { order: number }

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
  /** C182 — the Câmara coordinates that make the frame resolvable. */
  eventId?: number | null
  audioId?: number | null
  excerptTMs?: number | null
  /** C174 — normalized search text; lets the row tell whether it matched `q`. */
  searchText?: string | null
}

type SpeechListMatchKind = 'segment' | 'keyword' | 'theme' | 'fallback'

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
  /**
   * C182 — the frame of the middle of the speech when the Câmara can re-resolve
   * the excerpt, else the YouTube cover of the session (C175); null when
   * neither exists. The list never sees the raw VOD URLs.
   */
  thumbnailUrl: string | null
  watchHref: string
  /**
   * C177 — the official source (Diário) link; null when the speech has no
   * official text. Never falls back to `youtubeUrl`: a source button that
   * opened a video without the point is the duplicate atalho this item killed.
   */
  officialTextUrl: string | null
  /** C174 — the cuts already made from this speech, newest first. */
  cuts: SpeechCutSummaryViewModel[]
  /**
   * C174 — false when the speech surfaced only because one of its cuts matched
   * the term; the card then swaps the excerpt for the honest origin note.
   */
  matchedTextSearch: boolean
  /**
   * C229 — the semantic engine surfaced this row in the theme mode and the
   * excerpt is the real passage closest to the theme. The card uses it to show
   * the "Tema" seal and the "Trecho mais próximo do tema" block (no highlight,
   * no score); false in the literal/degraded path.
   */
  semanticMatch: boolean
  /**
   * C229 — the actor asked for the theme mode but the engine was down, so this
   * is a literal result of the degraded path; the card labels it "Termo exato"
   * (design scene 04) without changing the plain exact search.
   */
  literalFallback: boolean
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
  keywords: string[]
  topics: { value: SpeechTopic; label: string }[]
  scopes: { value: SpeechScope; label: string }[]
  municipalities: { id: number; name: string }[]
  segments: SpeechDetailSegmentViewModel[]
  /** YouTube default source (C162): id when the session link parses, else null. */
  youtubeVideoId: string | null
  /**
   * Session offset in seconds minus the video's own start delay (C172), null
   * when the excerpt has no known session offset.
   */
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

/**
 * C229 — the semantic evidence of one row: the real passage closest to the
 * theme (segment or text window) and its start when the player can seek to it.
 */
export type SpeechSemanticEvidence = {
  text: string
  startSeconds: number | null
}

/**
 * Shared seek/query trailer of both detail hrefs (Câmara and web): ASR
 * timestamps are fractional seconds, so the URL carries whole seconds, and the
 * search term rides along for the transcript highlight.
 */
const withSeekQuery = (
  href: string,
  startSeconds: number | null | undefined,
  query: string | undefined,
): string => {
  const params = new URLSearchParams()
  if (typeof startSeconds === 'number' && Number.isFinite(startSeconds)) {
    params.set('t', String(Math.max(0, Math.floor(startSeconds))))
  }
  if (query) params.set('q', query)
  const queryString = params.toString()
  return queryString ? `${href}?${queryString}` : href
}

export const buildWatchHref = (
  speechId: number,
  startSeconds: number | null | undefined,
  query: string | undefined,
): string => withSeekQuery(`${CAMPAIGN_COMMUNICATION_ACERVO}/${speechId}`, startSeconds, query)

type SpeechCuts = readonly SpeechCutSummaryViewModel[]

const thumbnailUrlOf = (speech: SpeechListRecord): string | null =>
  speechPosterTarget(speech) ? speechPosterHref(speech.id) : speechCoverUrl(speech.youtubeUrl)

export const toSpeechListItemViewModel = ({
  speech,
  segments,
  query,
  municipalityLabels,
  cuts = [],
  semanticMatch = false,
  literalFallback = false,
  semanticEvidence = null,
}: {
  speech: SpeechListRecord
  segments: readonly SpeechSegmentRecord[]
  query?: string
  municipalityLabels: ReadonlyMap<number, string>
  /** C174 — the cuts of this speech, nested in the result card. */
  cuts?: SpeechCuts
  /** C229 — the sense engine surfaced this row (a hit, by construction). */
  semanticMatch?: boolean
  /** C229 — literal result of the degraded theme path (design scene 04). */
  literalFallback?: boolean
  /** C229 — the passage closest to the theme; null when the row has no unit. */
  semanticEvidence?: SpeechSemanticEvidence | null
}): SpeechListItemViewModel => {
  const matchedSegment = pickMatchingSegment(segments, query)
  const q = query?.trim()
  const normalizedQuery = q ? normalizeForSearch(q) : ''
  const keywordMatch =
    !matchedSegment &&
    Boolean(normalizedQuery) &&
    (speech.keywords ?? []).some((keyword) => normalizeForSearch(keyword).includes(normalizedQuery))

  // C229 — the semantic evidence wins the excerpt so the theme card shows the
  // real passage closest to the sense searched, without any highlight (the
  // theme engine never matched a term) and without a score.
  const excerptSource =
    semanticEvidence?.text ??
    matchedSegment?.text ??
    segments[0]?.text ??
    speech.summary ??
    speech.officialTranscript ??
    ''

  const excerpt = buildHighlightedExcerpt(excerptSource, semanticMatch ? '' : (q ?? ''))

  return {
    id: speech.id,
    speechAtLabel: formatSpeechAt(speech.speechAt),
    type: speech.type ?? null,
    durationLabel: formatSpeechDuration(speech.durationSeconds),
    presidingOfficer: speech.presidingOfficer ?? null,
    excerpt,
    matchKind: semanticMatch
      ? 'theme'
      : matchedSegment
        ? 'segment'
        : keywordMatch
          ? 'keyword'
          : 'fallback',
    topics: topicViewModels(speech),
    scopes: scopeViewModels(speech),
    keywords: speech.keywords ?? [],
    municipalities: municipalityViewModels(speech, municipalityLabels),
    thumbnailUrl: thumbnailUrlOf(speech),
    watchHref: buildWatchHref(
      speech.id,
      semanticEvidence?.startSeconds ?? matchedSegment?.startSeconds,
      q,
    ),
    officialTextUrl: speech.officialTextUrl ?? null,
    cuts: [...cuts],
    matchedTextSearch: speechMatchesSearchQuery(speech, query),
    semanticMatch,
    literalFallback,
  }
}

export type SpeechDetailRecord = SpeechListRecord & {
  phase?: string | null
  eventStartAt?: string | null
}

export const toSpeechDetailViewModel = ({
  speech,
  segments,
  query,
  municipalityLabels,
  youtubeVideoStartAt = null,
}: {
  speech: SpeechDetailRecord
  segments: readonly SpeechSegmentRecord[]
  query?: string
  municipalityLabels: ReadonlyMap<number, string>
  /** Broadcast start (ISO) of the session video — the C172 anchor, when known. */
  youtubeVideoStartAt?: string | null
}): SpeechDetailViewModel => {
  // The stored VOD link is a cache and never a URL handed to the client; it
  // only signals that this record had a generated excerpt to re-resolve.
  const vodResolvable = speechVodCoordinates(speech) !== null
  const youtubeVideoId = parseYoutubeVideoId(speech.youtubeUrl)
  // C172 — measured evidence for this recording wins over the API anchor.
  const lagSeconds =
    measuredVideoLagSeconds(youtubeVideoId) ??
    sessionLagSeconds(youtubeVideoStartAt, speech.eventStartAt)

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
    youtubeVideoId,
    youtubeOffsetSeconds: correctedExcerptOffsetSeconds(
      excerptOffsetSeconds(speech.excerptTMs, speech.eventStartAt),
      lagSeconds,
    ),
    vodResolvable,
  }
}

// ---------------------------------------------------------------------------
// C216 — web speeches ("Falas na internet"): the same excerpt/segment machine
// over the mirrored private media, the origin attribution instead of the
// Câmara VOD coordinates. Same module: the collection, the facets and the
// formatting helpers are the shared knowledge.
// ---------------------------------------------------------------------------

export type WebSpeechListRecord = {
  id: number
  speechAt: string
  title?: string | null
  platform?: WebSpeechPlatform | null
  durationSeconds?: number | null
  topics?: SpeechTopic[] | null
  scopes?: SpeechScope[] | null
  /** Upload relation at depth 0 (id) or depth 1 (object); presence drives the cover. */
  thumbnail?: number | { id: number } | null
  /** Normalized search text; lets the row mirror the Câmara literal match. */
  searchText?: string | null
}

export type WebSpeechDetailRecord = WebSpeechListRecord & {
  channel?: string | null
  sourceUrl?: string | null
  mirroredMedia?: number | { id: number; mimeType?: string | null; filename?: string | null } | null
}

type WebSpeechPlatformViewModel = { value: WebSpeechPlatform | null; label: string }

export type WebSpeechListItemViewModel = {
  id: number
  title: string
  platform: WebSpeechPlatformViewModel
  /** Day-only label (`dd/mm/aaaa`) — the web publication date has no session clock. */
  dateLabel: string
  durationLabel: string | null
  excerpt: SpeechHighlightedExcerpt
  topics: { value: SpeechTopic; label: string }[]
  scopes: { value: SpeechScope; label: string }[]
  /** Authenticated cover route; null when the ingestion captured no thumbnail. */
  thumbnailUrl: string | null
  /** Detail link that seeks the player to the matching segment (`?t=`) and
   * keeps the search term for the transcript highlight (`?q=`). */
  watchHref: string
  /** C229 — the semantic engine surfaced this row; same contract as the Câmara. */
  semanticMatch: boolean
  /** C229 — literal result of the degraded theme path (design scene 04). */
  literalFallback: boolean
  /** C229 — the row also contains the literal query; the card shows "Termo exato". */
  matchedTextSearch: boolean
}

export type WebSpeechDetailViewModel = {
  id: number
  title: string
  platform: WebSpeechPlatformViewModel
  dateLabel: string
  durationLabel: string | null
  /** C217 — the raw stored duration the excerpt picker/cut dialog work with. */
  durationSeconds: number | null
  /** Who published (channel/radio/profile) — origin text, never a Contact. */
  channel: string | null
  /** Original post URL ("Abrir na origem"); null when the row has none. */
  sourceUrl: string | null
  /** Which native control the mirrored file needs. */
  mediaKind: 'video' | 'audio'
  /** Authenticated private media routes; null when the mirror is missing. */
  fileHref: string | null
  downloadHref: string | null
  segments: SpeechDetailSegmentViewModel[]
  topics: { value: SpeechTopic; label: string }[]
  scopes: { value: SpeechScope; label: string }[]
}

const webPlatformViewModel = (platform: WebSpeechPlatform | null | undefined) => ({
  value: platform ?? null,
  label: webSpeechPlatformLabel(platform),
})

const webSpeechTitle = (speech: WebSpeechListRecord): string =>
  webSpeechDisplayTitle({ id: speech.id, title: speech.title })

const buildWebSpeechWatchHref = (
  speechId: number,
  startSeconds: number | null | undefined,
  query: string | undefined,
): string => withSeekQuery(campaignInternetSpeechHref(speechId), startSeconds, query)

/**
 * List item of one web speech: platform chip, publication date + duration, the
 * matching excerpt (C229 semantic evidence preferred, like the Câmara) and the
 * private cover href. The cuts/VOD of the Câmara row have no counterpart here.
 */
export const toWebSpeechListItemViewModel = ({
  speech,
  segments,
  query,
  semanticMatch = false,
  literalFallback = false,
  semanticEvidence = null,
}: {
  speech: WebSpeechListRecord
  segments: readonly SpeechSegmentRecord[]
  query?: string
  /** C229 — the sense engine surfaced this row (a hit, by construction). */
  semanticMatch?: boolean
  /** C229 — literal result of the degraded theme path (design scene 04). */
  literalFallback?: boolean
  /** C229 — the passage closest to the theme; null when the row has no unit. */
  semanticEvidence?: SpeechSemanticEvidence | null
}): WebSpeechListItemViewModel => {
  const matchedSegment = pickMatchingSegment(segments, query)
  const q = query?.trim()
  const excerptSource = semanticEvidence?.text ?? matchedSegment?.text ?? segments[0]?.text ?? ''

  return {
    id: speech.id,
    title: webSpeechTitle(speech),
    platform: webPlatformViewModel(speech.platform),
    dateLabel: formatSpeechDate(speech.speechAt),
    durationLabel: formatSpeechDuration(speech.durationSeconds),
    excerpt: buildHighlightedExcerpt(excerptSource, semanticMatch ? '' : (q ?? '')),
    topics: topicViewModels(speech),
    scopes: scopeViewModels(speech),
    thumbnailUrl:
      relationshipId(speech.thumbnail) === null ? null : campaignInternetSpeechCoverHref(speech.id),
    watchHref: buildWebSpeechWatchHref(
      speech.id,
      semanticEvidence?.startSeconds ?? matchedSegment?.startSeconds,
      q,
    ),
    semanticMatch,
    literalFallback,
    matchedTextSearch: speechMatchesSearchQuery(speech, query),
  }
}

/** Audio artifacts get the native audio control; everything else is video. */
const mediaKindOf = (media: WebSpeechDetailRecord['mirroredMedia']): 'video' | 'audio' =>
  webSpeechMediaKind(media && typeof media === 'object' ? media.mimeType : null)

/**
 * Detail of one web speech: the private media routes, the origin attribution
 * (platform + channel + date) and the clickable transcript highlighted by `q`.
 * `fileHref` is null when the mirror is missing — the page renders the honest
 * unavailable state instead of a broken player.
 */
export const toWebSpeechDetailViewModel = ({
  speech,
  segments,
  query,
}: {
  speech: WebSpeechDetailRecord
  segments: readonly SpeechSegmentRecord[]
  query?: string
}): WebSpeechDetailViewModel => {
  const hasMedia = relationshipId(speech.mirroredMedia) !== null

  return {
    id: speech.id,
    title: webSpeechTitle(speech),
    platform: webPlatformViewModel(speech.platform),
    dateLabel: formatSpeechDate(speech.speechAt),
    durationLabel: formatSpeechDuration(speech.durationSeconds),
    durationSeconds: speech.durationSeconds ?? null,
    channel: speech.channel ?? null,
    sourceUrl: speech.sourceUrl ?? null,
    mediaKind: mediaKindOf(speech.mirroredMedia),
    fileHref: hasMedia ? campaignInternetSpeechFileHref(speech.id) : null,
    downloadHref: hasMedia ? campaignInternetSpeechFileHref(speech.id, true) : null,
    segments: segments.map((segment) => ({
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      startLabel: formatSpeechClock(segment.startSeconds),
      parts: splitHighlightedParts(segment.text, query ?? ''),
    })),
    topics: topicViewModels(speech),
    scopes: scopeViewModels(speech),
  }
}
