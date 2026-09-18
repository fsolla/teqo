import 'server-only'

import type { Payload } from 'payload'

import { canReadSpeechCatalog } from '@/lib/campaignRoles'
import { measuredVideoLagSeconds, parseYoutubeVideoId } from '@/lib/speechVod'
import type { CampaignUser, Speech } from '@/payload-types'
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
import { buildSpeechListWhereIncludingCutOrigins } from '@/utilities/speech/speechListFilters'
import {
  resolveSpeechListUrl,
  speechPageSize,
  type SpeechFilterOptions,
  type SpeechListState,
} from '@/utilities/speech/speechListUrl'
import {
  municipalityIdsOfSpeech,
  toSpeechDetailViewModel,
  toSpeechListItemViewModel,
  type SpeechDetailRecord,
  type SpeechDetailViewModel,
  type SpeechListItemViewModel,
  type SpeechSegmentRecord,
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
 * Options the URL filters offer: the years and phases actually present in the
 * catalog and the municipalities cited by at least one speech (labels resolved
 * through the justified `loadMunicipalityLabelsByIds` bypass — the ids come
 * from speeches the actor was already authorized to read).
 */
const loadSpeechFilterOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<SpeechFilterOptions> => {
  const result = await payload.find({
    collection: 'speech',
    depth: 0,
    limit: 0,
    pagination: false,
    select: { year: true, phase: true, mentionedMunicipalities: true },
    user,
    overrideAccess: false,
  })

  const years = new Set<number>()
  const phases = new Set<string>()
  const municipalityIds = new Set<number>()
  for (const speech of result.docs) {
    if (typeof speech.year === 'number') years.add(speech.year)
    if (speech.phase) phases.add(speech.phase)
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
  const themeRequested = state.mode === 'tema' && Boolean(state.q)
  let themeTerms: readonly string[] = []
  let themeUnavailable = false
  if (themeRequested && canReadSpeechCatalog(user.role)) {
    const expansion = await expandTheme(state.q ?? '')
    if (expansion) themeTerms = expansion.terms
    else themeUnavailable = true
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
    where: { id: { equals: speechId } },
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
