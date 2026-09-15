import 'server-only'

import type { Payload } from 'payload'

import {
  toSpeechCutLibraryItemViewModel,
  type SpeechCutLibraryItemViewModel,
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
