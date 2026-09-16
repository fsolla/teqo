import 'server-only'

import type { Payload } from 'payload'

import {
  originSpeechIdsOfCuts,
  SPEECH_CUT_ORIGIN_SPEECH_ID_LIMIT,
  toSpeechCutLibraryItemViewModel,
  toSpeechCutSummaryViewModel,
  type SpeechCutLibraryItemViewModel,
  type SpeechCutSummaryViewModel,
} from '@/lib/speechCut'
import type { CampaignUser } from '@/payload-types'
import { createEntityNotFoundError } from '@/utilities/entityNotFound'
import { findSpeechCutForActor } from '@/utilities/speech/speechCutData'
import {
  buildSpeechCutListWhere,
  parseSpeechCutListParams,
  resolveSpeechCutListUrl,
  speechCutPageSize,
  type SpeechCutListState,
} from '@/utilities/speech/speechCutListUrl'

type SpeechCutListSearchParams = Record<string, string | string[] | undefined>

/**
 * C180 — lean `select` for the discovery surfaces: only the fields the summary
 * view model renders, so the loaders stop hauling media/error/step rows. Keep
 * field-for-field with `SpeechCutSummaryRecord` (`lib/speechCut.ts`); Payload
 * does not reflect `select` in the result type, so the int test is the guard.
 */
const speechCutSummarySelect = {
  status: true,
  title: true,
  description: true,
  durationSeconds: true,
  startSeconds: true,
  endSeconds: true,
  // Kept so the batch loader can group rows by their origin speech.
  speech: true,
} as const

/** The origin loader only needs the speech relation to dedupe the origins. */
const speechCutOriginSelect = { speech: true } as const

export const SpeechCutNotFoundError = createEntityNotFoundError(
  'SpeechCut',
  'Corte não encontrado.',
)

export type SpeechCutAcervoPageData = {
  rows: SpeechCutLibraryItemViewModel[]
  state: SpeechCutListState
  redirectHref?: string
  totalDocs: number
  totalPages: number
}

/**
 * C168 — the cut library list: newest first, optional `q` over title/description
 * (ILIKE) and the house pagination. Depth 1 carries the origin speech; access is
 * the collection's own (`canReadSpeechCut` for the acervo reader).
 */
export const loadSpeechCutAcervoPageData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: Promise<SpeechCutListSearchParams> | SpeechCutListSearchParams,
): Promise<SpeechCutAcervoPageData> => {
  const rawSearchParams = await searchParams
  const state = parseSpeechCutListParams(rawSearchParams)

  const result = await payload.find({
    collection: 'speechCut',
    depth: 1,
    limit: speechCutPageSize,
    page: state.page,
    sort: '-createdAt',
    where: buildSpeechCutListWhere(state),
    user,
    overrideAccess: false,
  })

  const resolvedUrl = resolveSpeechCutListUrl(rawSearchParams, result.totalPages)

  return {
    rows: result.docs.map((cut) => toSpeechCutLibraryItemViewModel(cut)),
    state: resolvedUrl.state,
    redirectHref: resolvedUrl.redirectHref,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
  }
}

/**
 * C174 — every cut made from one speech, newest first, for the "Cortes desta
 * fala" section of the speech detail. Depth 0 is enough: the origin here IS the
 * page, and the section renders title/status/duration only — the summary select
 * keeps the query to what it shows. No page cap: the number of cuts per speech
 * is bounded by human effort.
 */
export const loadSpeechCutsForSpeech = async (
  payload: Payload,
  user: CampaignUser,
  speechId: number,
): Promise<SpeechCutSummaryViewModel[]> => {
  const result = await payload.find({
    collection: 'speechCut',
    where: { speech: { equals: speechId } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: '-createdAt',
    select: speechCutSummarySelect,
    user,
    overrideAccess: false,
  })

  return result.docs.map((cut) => toSpeechCutSummaryViewModel(cut))
}

/**
 * C174 — every cut of every speech on the acervo page, grouped by speech id, so
 * the result list nests them under the speech without a query per row. Same
 * precedent as `loadSegmentsForSpeeches`; depth 0 keeps the origin as the id and
 * the summary select carries only what the nested card renders.
 */
export const loadSpeechCutsForSpeeches = async (
  payload: Payload,
  user: CampaignUser,
  speechIds: readonly number[],
): Promise<Map<number, SpeechCutSummaryViewModel[]>> => {
  const bySpeech = new Map<number, SpeechCutSummaryViewModel[]>()
  if (speechIds.length === 0) return bySpeech

  const result = await payload.find({
    collection: 'speechCut',
    where: { speech: { in: [...speechIds] } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: '-createdAt',
    select: speechCutSummarySelect,
    user,
    overrideAccess: false,
  })

  for (const cut of result.docs) {
    const speechId = typeof cut.speech === 'number' ? cut.speech : cut.speech?.id
    if (typeof speechId !== 'number') continue
    const list = bySpeech.get(speechId) ?? []
    list.push(toSpeechCutSummaryViewModel(cut))
    bySpeech.set(speechId, list)
  }
  return bySpeech
}

/**
 * C174 (option B) — the origin speech ids of the cuts whose own title/description
 * match `q`. The acervo search uses them to surface a speech through a cut even
 * when the speech text itself does not contain the term.
 *
 * C180 — the query is capped at `SPEECH_CUT_ORIGIN_SPEECH_ID_LIMIT`: a common
 * term must not let the acervo's `id in [...]` grow without bound. The cap only
 * trims origin-only hits; it never makes a returned row wrong.
 */
export const loadSpeechCutOriginSpeechIds = async (
  payload: Payload,
  user: CampaignUser,
  q: string,
): Promise<number[]> => {
  const result = await payload.find({
    collection: 'speechCut',
    where: buildSpeechCutListWhere({ page: 1, q }),
    depth: 0,
    limit: SPEECH_CUT_ORIGIN_SPEECH_ID_LIMIT,
    pagination: false,
    select: speechCutOriginSelect,
    user,
    overrideAccess: false,
  })

  return originSpeechIdsOfCuts(result.docs)
}

/** One cut with its origin and stored media, for the library detail page. */
export const loadSpeechCutDetailPageData = async (
  payload: Payload,
  user: CampaignUser,
  cutId: number,
): Promise<SpeechCutLibraryItemViewModel> => {
  const cut = await findSpeechCutForActor(payload, user, cutId)
  if (!cut) throw new SpeechCutNotFoundError()

  return toSpeechCutLibraryItemViewModel(cut)
}
