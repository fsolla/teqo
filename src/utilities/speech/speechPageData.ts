import 'server-only'

import type { Payload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { measuredVideoLagSeconds, parseYoutubeVideoId } from '@/lib/speechVod'
import type { CampaignUser, InternetSpeechMedia, Speech } from '@/payload-types'
import {
  expandSpeechSearchTheme,
  type SpeechThemeExpansionResolver,
} from '@/utilities/ai/expandSpeechSearchTheme'
import { createEntityNotFoundError } from '@/utilities/entityNotFound'
import { loadMunicipalityLabelsByIds } from '@/utilities/loadNamesByIds'
import { getYouTubeVideoStart } from '@/utilities/socialFeed/youtubeFeed'
import {
  loadSpeechCutOriginSpeechIds,
  loadSpeechCutsForSpeeches,
} from '@/utilities/speech/speechCutPageData'
import {
  buildSpeechListWhere,
  buildSpeechListWhereIncludingCutOrigins,
} from '@/utilities/speech/speechListFilters'
import {
  resolveSpeechListUrl,
  speechPageSize,
  webSpeechSortOrder,
  type SpeechFilterOptions,
  type SpeechListState,
} from '@/utilities/speech/speechListUrl'
import {
  municipalityIdsOfSpeech,
  toSpeechDetailViewModel,
  toSpeechListItemViewModel,
  toWebSpeechDetailViewModel,
  toWebSpeechListItemViewModel,
  type SpeechDetailRecord,
  type SpeechDetailViewModel,
  type SpeechListItemViewModel,
  type SpeechSegmentRecord,
  type WebSpeechDetailRecord,
  type WebSpeechDetailViewModel,
  type WebSpeechListItemViewModel,
  type WebSpeechListRecord,
} from '@/utilities/speech/speechViewModels'

type SpeechListSearchParams = Record<string, string | string[] | undefined>

export const SpeechNotFoundError = createEntityNotFoundError('Speech', 'Fala não encontrada.')

const speechListSelect = {
  speechAt: true,
  type: true,
  durationSeconds: true,
  summary: true,
  officialTranscript: true,
  keywords: true,
  topics: true,
  scopes: true,
  mentionedMunicipalities: true,
  presidingOfficer: true,
  officialTextUrl: true,
  youtubeUrl: true,
  // C182 — the list decides the frame from the Câmara coordinates alone; the
  // stored VOD links stay out of the list query (the poster job reads them).
  eventId: true,
  audioId: true,
  excerptTMs: true,
} as const

const speechDetailSelect = {
  ...speechListSelect,
  phase: true,
  vodPlaybackUrl: true,
  vodDownloadUrl: true,
  eventStartAt: true,
} as const

const segmentSelect = {
  speech: true,
  startSeconds: true,
  endSeconds: true,
  text: true,
} as const

const municipalityNameMap = (
  labels: Awaited<ReturnType<typeof loadMunicipalityLabelsByIds>>,
): Map<number, string> => new Map([...labels.entries()].map(([id, entry]) => [id, entry.name]))

/**
 * Options the URL filters offer: the years (and, for the Câmara, the phases)
 * actually present in the source's catalog and the municipalities cited by at
 * least one speech (labels resolved through the justified
 * `loadMunicipalityLabelsByIds` bypass — the ids come from speeches the actor
 * was already authorized to read). C216 — the source discriminator keeps the
 * options of each list over its own rows; the web list has no phase facet.
 */
const loadSpeechFilterOptions = async (
  payload: Payload,
  user: CampaignUser,
  origin: 'camara' | 'web' = 'camara',
): Promise<SpeechFilterOptions> => {
  const result = await payload.find({
    collection: 'speech',
    depth: 0,
    limit: 0,
    pagination: false,
    where: { origin: { equals: origin } },
    select: { year: true, phase: true, mentionedMunicipalities: true },
    user,
    overrideAccess: false,
  })

  const years = new Set<number>()
  const phases = new Set<string>()
  const municipalityIds = new Set<number>()
  for (const speech of result.docs) {
    if (typeof speech.year === 'number') years.add(speech.year)
    if (origin === 'camara' && speech.phase) phases.add(speech.phase)
    for (const id of municipalityIdsOfSpeech(speech)) municipalityIds.add(id)
  }

  const labels = await loadMunicipalityLabelsByIds(payload, [...municipalityIds])
  const municipalities = [...municipalityIds]
    .flatMap((id) => {
      const entry = labels.get(id)
      return entry ? [{ value: String(id), label: entry.name }] : []
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  return {
    years: [...years].sort((left, right) => right - left),
    phases: [...phases].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    municipalities,
  }
}

/**
 * C216 — the shared theme gate of both sources: expands only for an actor who
 * may read the catalog (the `find` is still the final barrier) and only with a
 * query. The caller injects the resolver so the tests stay offline.
 */
const resolveSpeechThemeTerms = async ({
  state,
  role,
  expandTheme,
}: {
  state: SpeechListState
  role: CampaignUser['role']
  expandTheme: SpeechThemeExpansionResolver
}): Promise<{ themeTerms: readonly string[]; themeUnavailable: boolean }> => {
  const themeRequested = state.mode === 'tema' && Boolean(state.q)
  if (!themeRequested || !canReadCommunicationCatalog(role)) {
    return { themeTerms: [], themeUnavailable: false }
  }
  const expansion = await expandTheme(state.q ?? '')
  return expansion
    ? { themeTerms: expansion.terms, themeUnavailable: false }
    : { themeTerms: [], themeUnavailable: true }
}

export const loadSegmentsForSpeeches = async (
  payload: Payload,
  user: CampaignUser,
  speechIds: readonly number[],
): Promise<Map<number, SpeechSegmentRecord[]>> => {
  const bySpeech = new Map<number, SpeechSegmentRecord[]>()
  if (speechIds.length === 0) return bySpeech

  const result = await payload.find({
    collection: 'speechSegment',
    where: { speech: { in: [...speechIds] } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'order',
    select: segmentSelect,
    user,
    overrideAccess: false,
  })

  for (const segment of result.docs) {
    const speechId = typeof segment.speech === 'number' ? segment.speech : segment.speech.id
    const list = bySpeech.get(speechId) ?? []
    list.push({
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      text: segment.text,
    })
    bySpeech.set(speechId, list)
  }
  return bySpeech
}

export type SpeechAcervoPageData = {
  rows: SpeechListItemViewModel[]
  state: SpeechListState
  redirectHref?: string
  totalDocs: number
  totalPages: number
  filterOptions: SpeechFilterOptions
  /**
   * C192 — true when the actor asked for `mode=tema` but the expansion
   * mechanism was unavailable; the page shows the discreet fallback notice.
   */
  themeUnavailable: boolean
  /** C192 — true when the expansion actually contributed terms. */
  themeApplied: boolean
}

export const loadSpeechAcervoPageData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: Promise<SpeechListSearchParams> | SpeechListSearchParams,
  expandTheme: SpeechThemeExpansionResolver = expandSpeechSearchTheme,
): Promise<SpeechAcervoPageData> => {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveSpeechListUrl(rawSearchParams)
  const state = canonicalUrl.state

  // C192 — only expand for an actor who may read the catalog (the `find` below
  // is still the final, fail-closed barrier) and only with a query.
  const { themeTerms, themeUnavailable } = await resolveSpeechThemeTerms({
    state,
    role: user.role,
    expandTheme,
  })

  // C174 (option B) — a speech also shows up when one of its cuts matches the
  // term by title/description, even if the speech text itself does not.
  const originSpeechIds = state.q ? await loadSpeechCutOriginSpeechIds(payload, user, state.q) : []

  const result = await payload.find({
    collection: 'speech',
    depth: 0,
    limit: speechPageSize,
    page: state.page,
    sort: '-speechAt',
    where: buildSpeechListWhereIncludingCutOrigins(state, originSpeechIds, themeTerms),
    // C174 — the row only needs its normalized text to tell whether it matched
    // the term itself (option B); the unsearched list does not pay for it.
    select: state.q ? { ...speechListSelect, searchText: true } : speechListSelect,
    user,
    overrideAccess: false,
  })

  const resolvedUrl = resolveSpeechListUrl(rawSearchParams, result.totalPages)
  const speeches = result.docs as Speech[]
  const speechIds = speeches.map((speech) => speech.id)

  const [segmentsBySpeech, cutsBySpeech, filterOptions] = await Promise.all([
    loadSegmentsForSpeeches(payload, user, speechIds),
    loadSpeechCutsForSpeeches(payload, user, speechIds),
    loadSpeechFilterOptions(payload, user),
  ])

  const municipalityIds = new Set<number>()
  for (const speech of speeches) {
    for (const id of municipalityIdsOfSpeech(speech)) municipalityIds.add(id)
  }
  const municipalityLabels = municipalityNameMap(
    await loadMunicipalityLabelsByIds(payload, [...municipalityIds]),
  )

  return {
    rows: speeches.map((speech) =>
      toSpeechListItemViewModel({
        speech,
        segments: segmentsBySpeech.get(speech.id) ?? [],
        query: state.q,
        municipalityLabels,
        cuts: cutsBySpeech.get(speech.id) ?? [],
        themeTerms,
      }),
    ),
    state: resolvedUrl.state,
    redirectHref: resolvedUrl.redirectHref ?? canonicalUrl.redirectHref,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    filterOptions,
    themeUnavailable,
    themeApplied: themeTerms.length > 0,
  }
}

// ---------------------------------------------------------------------------
// C216 — "Falas na internet" loaders. Same collection/segments/facets; the row
// carries the web fields (origin, platform, title, channel, source URL and the
// mirrored private media) instead of the Câmara VOD coordinates.
// ---------------------------------------------------------------------------

const webSpeechListSelect = {
  speechAt: true,
  title: true,
  platform: true,
  durationSeconds: true,
  topics: true,
  scopes: true,
  // The cover href only needs the relation's presence (depth 0 id).
  thumbnail: true,
} as const

const webSpeechDetailSelect = {
  ...webSpeechListSelect,
  sourceUrl: true,
  channel: true,
  mirroredMedia: true,
} as const

export type WebSpeechAcervoPageData = {
  rows: WebSpeechListItemViewModel[]
  state: SpeechListState
  redirectHref?: string
  totalDocs: number
  totalPages: number
  filterOptions: SpeechFilterOptions
  /** C216 — true when `mode=tema` was asked but the expansion was unavailable. */
  themeUnavailable: boolean
  /** C216 — true when the expansion actually contributed terms. */
  themeApplied: boolean
}

/**
 * The web speeches list ("Falas na internet"). The source is forced here — the
 * page dispatches on `source=internet`, and forcing it makes the loader
 * self-contained (an int test calls it directly) and its canonical redirect
 * always carry the source. Only web rows are read: `buildSpeechListWhere`
 * derives `origin: web` from the state.
 */
export const loadWebSpeechAcervoPageData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: Promise<SpeechListSearchParams> | SpeechListSearchParams,
  expandTheme: SpeechThemeExpansionResolver = expandSpeechSearchTheme,
): Promise<WebSpeechAcervoPageData> => {
  const rawSearchParams = await searchParams
  // The source is forced (the page dispatches on `source=internet`): the
  // canonical redirect always carries it and the loader is self-contained.
  const webSourceParams = { ...rawSearchParams, source: 'internet' }
  const canonicalUrl = resolveSpeechListUrl(webSourceParams)
  const state = canonicalUrl.state

  const { themeTerms, themeUnavailable } = await resolveSpeechThemeTerms({
    state,
    role: user.role,
    expandTheme,
  })

  const result = await payload.find({
    collection: 'speech',
    depth: 0,
    limit: speechPageSize,
    page: state.page,
    sort: webSpeechSortOrder(state),
    where: buildSpeechListWhere(state, themeTerms),
    // The row only needs its normalized text to tell whether it matched the
    // term itself; the unsearched list does not pay for it.
    select: state.q ? { ...webSpeechListSelect, searchText: true } : webSpeechListSelect,
    user,
    overrideAccess: false,
  })

  const resolvedUrl = resolveSpeechListUrl(webSourceParams, result.totalPages)
  const speeches = result.docs as WebSpeechListRecord[]
  const speechIds = speeches.map((speech) => speech.id)

  const [segmentsBySpeech, filterOptions] = await Promise.all([
    loadSegmentsForSpeeches(payload, user, speechIds),
    loadSpeechFilterOptions(payload, user, 'web'),
  ])

  return {
    rows: speeches.map((speech) =>
      toWebSpeechListItemViewModel({
        speech,
        segments: segmentsBySpeech.get(speech.id) ?? [],
        query: state.q,
        themeTerms,
      }),
    ),
    state: resolvedUrl.state,
    redirectHref: resolvedUrl.redirectHref ?? canonicalUrl.redirectHref,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    filterOptions,
    themeUnavailable,
    themeApplied: themeTerms.length > 0,
  }
}

/**
 * Title-only read for `generateMetadata`: never loads the transcript of a long
 * recording just to title the tab (same shape as the recordings detail).
 */
export const loadWebSpeechTitleForActor = async (
  payload: Payload,
  user: CampaignUser,
  speechId: number,
): Promise<string | null> => {
  const result = await payload.find({
    collection: 'speech',
    where: { and: [{ id: { equals: speechId } }, { origin: { equals: 'web' } }] },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { title: true },
    user,
    overrideAccess: false,
  })
  return result.docs[0]?.title ?? null
}

export const loadWebSpeechDetailPageData = async (
  payload: Payload,
  user: CampaignUser,
  speechId: number,
  query?: string,
): Promise<WebSpeechDetailViewModel> => {
  const result = await payload.find({
    collection: 'speech',
    where: { and: [{ id: { equals: speechId } }, { origin: { equals: 'web' } }] },
    depth: 1,
    limit: 1,
    pagination: false,
    select: webSpeechDetailSelect,
    user,
    overrideAccess: false,
  })
  const speech = result.docs[0]
  if (!speech) throw new SpeechNotFoundError()

  const segmentsBySpeech = await loadSegmentsForSpeeches(payload, user, [speechId])

  return toWebSpeechDetailViewModel({
    speech: speech as WebSpeechDetailRecord,
    segments: segmentsBySpeech.get(speechId) ?? [],
    query,
  })
}

/** The two private upload relations one web speech serves through its routes. */
export type WebSpeechMediaField = 'mirroredMedia' | 'thumbnail'

/**
 * C216 — the shared read of the two media routes (`/arquivo` and `/capa`): one
 * `findByID` with the acervo gate and the origin filter, answering null for
 * anything that is not a web row with that artifact. The routes keep the HTTP
 * contract (silent 404, range, disposition) and the caller's auth gate.
 */
export const loadWebSpeechMediaForActor = async (
  payload: Payload,
  user: CampaignUser,
  speechId: number,
  field: WebSpeechMediaField,
): Promise<{ title: string | null; media: InternetSpeechMedia } | null> => {
  const speech = await payload
    .findByID({
      collection: 'speech',
      id: speechId,
      depth: 1,
      select: { origin: true, title: true, mirroredMedia: true, thumbnail: true },
      user,
      overrideAccess: false,
    })
    .catch(() => null)
  if (!speech || speech.origin !== 'web') return null

  const media = field === 'mirroredMedia' ? speech.mirroredMedia : speech.thumbnail
  if (!media || typeof media !== 'object') return null

  return { title: speech.title ?? null, media }
}

/**
 * Resolves the broadcast start (ISO) of a session video. The default reads the
 * cached YouTube anchor (C172); tests inject their own to stay offline.
 */
export type SpeechVideoStartResolver = (videoId: string) => Promise<string | null>

export const loadSpeechDetailPageData = async (
  payload: Payload,
  user: CampaignUser,
  speechId: number,
  query?: string,
  resolveVideoStart: SpeechVideoStartResolver = getYouTubeVideoStart,
): Promise<SpeechDetailViewModel> => {
  const result = await payload.find({
    collection: 'speech',
    // C216 — this detail is the Câmara's: a web row has its own route and
    // player, so an id of the other origin is an honest 404 here (and the
    // reverse holds in the web loader).
    where: { and: [{ id: { equals: speechId } }, { origin: { equals: 'camara' } }] },
    depth: 0,
    limit: 1,
    pagination: false,
    select: speechDetailSelect,
    user,
    overrideAccess: false,
  })
  const speech = result.docs[0]
  if (!speech) throw new SpeechNotFoundError()

  // C172 — the anchor belongs to the session video and is only worth asking
  // for when the row links one AND no measurement already covers it; unknown
  // stays null (no correction).
  const videoId = parseYoutubeVideoId(speech.youtubeUrl)
  const skipAnchor = videoId === null || measuredVideoLagSeconds(videoId) !== null

  const [segments, municipalityLabels, youtubeVideoStartAt] = await Promise.all([
    payload.find({
      collection: 'speechSegment',
      where: { speech: { equals: speechId } },
      depth: 0,
      limit: 0,
      pagination: false,
      sort: 'order',
      select: segmentSelect,
      user,
      overrideAccess: false,
    }),
    loadMunicipalityLabelsByIds(payload, municipalityIdsOfSpeech(speech)).then(municipalityNameMap),
    skipAnchor ? null : resolveVideoStart(videoId),
  ])

  return toSpeechDetailViewModel({
    speech: speech as SpeechDetailRecord,
    segments: segments.docs.map((segment) => ({
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      text: segment.text,
    })),
    query,
    municipalityLabels,
    youtubeVideoStartAt,
  })
}
