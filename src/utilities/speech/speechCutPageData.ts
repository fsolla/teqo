import 'server-only'

import type { Payload } from 'payload'

import {
  toSpeechCutLibraryItemViewModel,
  toSpeechCutViewModel,
  type SpeechCutLibraryItemViewModel,
  type SpeechCutViewModel,
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
 * page, and the section renders title/status/duration only (`error` still feeds
 * the honest `failureMessage`, never the raw cause). No page cap: the number of
 * cuts per speech is bounded by human effort.
 */
export const loadSpeechCutsForSpeech = async (
  payload: Payload,
  user: CampaignUser,
  speechId: number,
): Promise<SpeechCutViewModel[]> => {
  const result = await payload.find({
    collection: 'speechCut',
    where: { speech: { equals: speechId } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: '-createdAt',
    user,
    overrideAccess: false,
  })

  return result.docs.map((cut) => toSpeechCutViewModel(cut))
}

/**
 * C174 — every cut of every speech on the acervo page, grouped by speech id, so
 * the result list nests them under the speech without a query per row. Same
 * precedent as `loadSegmentsForSpeeches`; depth 0 keeps the origin as the id.
 */
export const loadSpeechCutsForSpeeches = async (
  payload: Payload,
  user: CampaignUser,
  speechIds: readonly number[],
): Promise<Map<number, SpeechCutViewModel[]>> => {
  const bySpeech = new Map<number, SpeechCutViewModel[]>()
  if (speechIds.length === 0) return bySpeech

  const result = await payload.find({
    collection: 'speechCut',
    where: { speech: { in: [...speechIds] } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: '-createdAt',
    user,
    overrideAccess: false,
  })

  for (const cut of result.docs) {
    const speechId = typeof cut.speech === 'number' ? cut.speech : cut.speech?.id
    if (typeof speechId !== 'number') continue
    const list = bySpeech.get(speechId) ?? []
    list.push(toSpeechCutViewModel(cut))
    bySpeech.set(speechId, list)
  }
  return bySpeech
}

/**
 * C174 (option B) — the origin speech ids of the cuts whose own title/description
 * match `q`. The acervo search uses them to surface a speech through a cut even
 * when the speech text itself does not contain the term.
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
    limit: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })

  const ids = new Set<number>()
  for (const cut of result.docs) {
    const speechId = typeof cut.speech === 'number' ? cut.speech : cut.speech?.id
    if (typeof speechId === 'number') ids.add(speechId)
  }
  return [...ids]
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
