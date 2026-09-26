import 'server-only'

import type { Payload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { speechSemanticSourceText, type SpeechSemanticVector } from '@/lib/speechSemantic'
import { measuredVideoLagSeconds, parseYoutubeVideoId } from '@/lib/speechVod'
import type { CampaignUser, Speech } from '@/payload-types'
import { embedSpeechQuery, type SpeechQueryEmbeddingResolver } from '@/utilities/ai/deepInfraEmbed'
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
  loadSpeechSemanticEvidence,
  searchSpeechesByMeaning,
} from '@/utilities/speech/speechSemanticSearch'
import {
  municipalityIdsOfSpeech,
  toSpeechDetailViewModel,
  toSpeechListItemViewModel,
  toWebSpeechDetailViewModel,
  toWebSpeechListItemViewModel,
  type SpeechDetailRecord,
  type SpeechDetailViewModel,
  type SpeechListItemViewModel,
  type SpeechSegmentRecordWithOrder,
  type SpeechSemanticEvidence,
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
  order: true,
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

export const loadSegmentsForSpeeches = async (
  payload: Payload,
  user: CampaignUser,
  speechIds: readonly number[],
): Promise<Map<number, SpeechSegmentRecordWithOrder[]>> => {
  const bySpeech = new Map<number, SpeechSegmentRecordWithOrder[]>()
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
      order: segment.order,
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      text: segment.text,
    })
    bySpeech.set(speechId, list)
  }
  return bySpeech
}

/**
 * C229 — the full docs of a page of semantic hits, in the ranking order (a
 * Payload `in` does not preserve it) and through the access layer.
 */
const loadSpeechDocsByIds = async (
  payload: Payload,
  user: CampaignUser,
  ids: readonly number[],
  select: Record<string, boolean>,
): Promise<Speech[]> => {
  if (ids.length === 0) return []
  const result = await payload.find({
    collection: 'speech',
    where: { id: { in: [...ids] } },
    depth: 0,
    limit: 0,
    pagination: false,
    select,
    user,
    overrideAccess: false,
  })
  const byId = new Map(result.docs.map((doc) => [doc.id, doc as Speech]))
  return ids.flatMap((id) => {
    const doc = byId.get(id)
    return doc ? [doc] : []
  })
}

type SemanticSpeechPage = {
  speeches: Speech[]
  segmentsBySpeech: Map<number, SpeechSegmentRecordWithOrder[]>
  evidenceBySpeech: Map<number, SpeechSemanticEvidence>
  totalDocs: number
  totalPages: number
  state: SpeechListState
  redirectHref?: string
}

/**
 * C229 — the sense page shared by both sources: rank the facet-allowed
 * candidates, slice the requested page in memory, load the full docs in
 * ranking order and resolve the real passage closest to the theme. Returns
 * `null` when the engine must degrade (there are candidates but none is
 * indexed); a candidate-less combination is an honest empty page, not a
 * degradation — the engine ran and there is nothing to match.
 */
const loadSemanticSpeechPage = async ({
  payload,
  user,
  state,
  rawSearchParams,
  queryVector,
  select,
}: {
  payload: Payload
  user: CampaignUser
  state: SpeechListState
  rawSearchParams: SpeechListSearchParams
  queryVector: SpeechSemanticVector
  select: Record<string, boolean>
}): Promise<SemanticSpeechPage | null> => {
  const { hits, candidates, indexedCandidates } = await searchSpeechesByMeaning(
    payload,
    user,
    state,
    queryVector,
  )
  if (candidates > 0 && indexedCandidates === 0) return null

  const totalPages = Math.max(1, Math.ceil(hits.length / speechPageSize))
  const resolvedUrl = resolveSpeechListUrl(rawSearchParams, totalPages)
  const page = resolvedUrl.state.page
  const pageHits = hits.slice((page - 1) * speechPageSize, page * speechPageSize)
  const speeches = await loadSpeechDocsByIds(
    payload,
    user,
    pageHits.map((hit) => hit.id),
    select,
  )
  const speechIds = speeches.map((speech) => speech.id)

  const segmentsBySpeech = await loadSegmentsForSpeeches(payload, user, speechIds)
  const evidenceBySpeech = await loadSpeechSemanticEvidence(
    payload,
    user,
    queryVector,
    speechIds,
    segmentsBySpeech,
    new Map(speeches.map((speech) => [speech.id, speechSemanticSourceText(speech)])),
  )

  return {
    speeches,
    segmentsBySpeech,
    evidenceBySpeech,
    totalDocs: hits.length,
    totalPages,
    state: resolvedUrl.state,
    redirectHref: resolvedUrl.redirectHref,
  }
}

export type SpeechAcervoPageData = {
  rows: SpeechListItemViewModel[]
  state: SpeechListState
  redirectHref?: string
  totalDocs: number
  totalPages: number
  filterOptions: SpeechFilterOptions
  /**
   * C229 — true when the actor asked for `mode=tema` but the sense engine was
   * unavailable (no provider or no indexed candidate); the page shows the
   * discreet fallback notice over the literal results.
   */
  themeUnavailable: boolean
  /** C229 — true when the sense engine actually ran this request. */
  themeApplied: boolean
}

export const loadSpeechAcervoPageData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: Promise<SpeechListSearchParams> | SpeechListSearchParams,
  embedQuery: SpeechQueryEmbeddingResolver = embedSpeechQuery,
): Promise<SpeechAcervoPageData> => {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveSpeechListUrl(rawSearchParams)
  const state = canonicalUrl.state

  // C229 — the theme mode is the sense engine: the query is embedded once and
  // the facet-allowed candidates are ranked over the stored speech-level
  // vectors. A missing mechanism (no key/provider error) or an empty index
  // degrades to the literal search below with the discreet notice; the literal
  // `q` LIKE and the C174 cut-origin lookup never run in the semantic path.
  const themeRequested = state.mode === 'tema' && Boolean(state.q)
  const actorCanRead = canReadCommunicationCatalog(user.role)
  if (themeRequested && actorCanRead) {
    const queryVector = await embedQuery(state.q ?? '')
    if (queryVector) {
      const page = await loadSemanticSpeechPage({
        payload,
        user,
        state,
        rawSearchParams,
        queryVector,
        select: { ...speechListSelect, searchText: true },
      })
      if (page) {
        const speechIds = page.speeches.map((speech) => speech.id)
        const [cutsBySpeech, filterOptions] = await Promise.all([
          loadSpeechCutsForSpeeches(payload, user, speechIds),
          loadSpeechFilterOptions(payload, user),
        ])

        const municipalityIds = new Set<number>()
        for (const speech of page.speeches) {
          for (const id of municipalityIdsOfSpeech(speech)) municipalityIds.add(id)
        }
        const municipalityLabels = municipalityNameMap(
          await loadMunicipalityLabelsByIds(payload, [...municipalityIds]),
        )

        return {
          rows: page.speeches.map((speech) =>
            toSpeechListItemViewModel({
              speech,
              segments: page.segmentsBySpeech.get(speech.id) ?? [],
              query: state.q,
              municipalityLabels,
              cuts: cutsBySpeech.get(speech.id) ?? [],
              semanticMatch: true,
              semanticEvidence: page.evidenceBySpeech.get(speech.id) ?? null,
            }),
          ),
          state: page.state,
          redirectHref: page.redirectHref ?? canonicalUrl.redirectHref,
          totalDocs: page.totalDocs,
          totalPages: page.totalPages,
          filterOptions,
          themeUnavailable: false,
          themeApplied: true,
        }
      }
    }
  }

  // C174 (option B) — a speech also shows up when one of its cuts matches the
  // term by title/description, even if the speech text itself does not.
  const originSpeechIds = state.q ? await loadSpeechCutOriginSpeechIds(payload, user, state.q) : []

  const result = await payload.find({
    collection: 'speech',
    depth: 0,
    limit: speechPageSize,
    page: state.page,
    sort: '-speechAt',
    where: buildSpeechListWhereIncludingCutOrigins(state, originSpeechIds),
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

  const themeUnavailable = themeRequested && actorCanRead
  return {
    rows: speeches.map((speech) =>
      toSpeechListItemViewModel({
        speech,
        segments: segmentsBySpeech.get(speech.id) ?? [],
        query: state.q,
        municipalityLabels,
        cuts: cutsBySpeech.get(speech.id) ?? [],
        literalFallback: themeUnavailable,
      }),
    ),
    state: resolvedUrl.state,
    redirectHref: resolvedUrl.redirectHref ?? canonicalUrl.redirectHref,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    filterOptions,
    themeUnavailable,
    themeApplied: false,
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

/** C229 — the theme path needs the source text of the evidence windows. */
const webSpeechThemeSelect = {
  ...webSpeechListSelect,
  searchText: true,
  officialTranscript: true,
  summary: true,
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
  /** C229 — true when `mode=tema` was asked but the sense engine was unavailable. */
  themeUnavailable: boolean
  /** C229 — true when the sense engine actually ran this request. */
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
  embedQuery: SpeechQueryEmbeddingResolver = embedSpeechQuery,
): Promise<WebSpeechAcervoPageData> => {
  const rawSearchParams = await searchParams
  // The source is forced (the page dispatches on `source=internet`): the
  // canonical redirect always carries it and the loader is self-contained.
  const webSourceParams = { ...rawSearchParams, source: 'internet' }
  const canonicalUrl = resolveSpeechListUrl(webSourceParams)
  const state = canonicalUrl.state

  // C229 — same sense engine as the Câmara source; the degradation contract is
  // identical (notice over literal results, never an error).
  const themeRequested = state.mode === 'tema' && Boolean(state.q)
  const actorCanRead = canReadCommunicationCatalog(user.role)
  if (themeRequested && actorCanRead) {
    const queryVector = await embedQuery(state.q ?? '')
    if (queryVector) {
      const page = await loadSemanticSpeechPage({
        payload,
        user,
        state,
        rawSearchParams: webSourceParams,
        queryVector,
        select: webSpeechThemeSelect,
      })
      if (page) {
        const filterOptions = await loadSpeechFilterOptions(payload, user, 'web')

        return {
          rows: page.speeches.map((speech) =>
            toWebSpeechListItemViewModel({
              speech: speech as WebSpeechListRecord,
              segments: page.segmentsBySpeech.get(speech.id) ?? [],
              query: state.q,
              semanticMatch: true,
              semanticEvidence: page.evidenceBySpeech.get(speech.id) ?? null,
            }),
          ),
          state: page.state,
          redirectHref: page.redirectHref ?? canonicalUrl.redirectHref,
          totalDocs: page.totalDocs,
          totalPages: page.totalPages,
          filterOptions,
          themeUnavailable: false,
          themeApplied: true,
        }
      }
    }
  }

  const result = await payload.find({
    collection: 'speech',
    depth: 0,
    limit: speechPageSize,
    page: state.page,
    sort: webSpeechSortOrder(state),
    where: buildSpeechListWhere(state),
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

  const themeUnavailable = themeRequested && actorCanRead
  return {
    rows: speeches.map((speech) =>
      toWebSpeechListItemViewModel({
        speech,
        segments: segmentsBySpeech.get(speech.id) ?? [],
        query: state.q,
        literalFallback: themeUnavailable,
      }),
    ),
    state: resolvedUrl.state,
    redirectHref: resolvedUrl.redirectHref ?? canonicalUrl.redirectHref,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    filterOptions,
    themeUnavailable,
    themeApplied: false,
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
      order: segment.order,
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      text: segment.text,
    })),
    query,
    municipalityLabels,
    youtubeVideoStartAt,
  })
}
