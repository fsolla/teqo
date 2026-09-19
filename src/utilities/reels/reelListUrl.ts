/**
 * C194 — URL contract of the reel library list (`/campanha/comunicacao/reels`):
 * pagination only. The MVP has no search or filters (intention: the acervo is
 * small and the job is scanning covers), so `page` is the whole state.
 */
import { CAMPAIGN_COMMUNICATION_REELS } from '@/lib/campaignPaths'
import {
  buildListHref,
  firstValue,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const reelPageSize = 24

export type ReelListState = {
  page: number
}

const reelListParamNames = ['page'] as const

const reelListParamNameSet = new Set<string>(reelListParamNames)

export const parseReelListParams = (params: RawSearchParams): ReelListState => ({
  page: strictDecimalInteger(firstValue(params.page)) ?? 1,
})

const serializeCanonicalReelListSearchParams = (state: ReelListState): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.page > 1) params.set('page', String(state.page))
  return params
}

const buildReelListSearchParams = (state: ReelListState, page = state.page): URLSearchParams =>
  serializeCanonicalReelListSearchParams(
    parseReelListParams({
      page: String(page),
    }),
  )

export const buildReelListHref = (state: ReelListState, page: number): string =>
  buildListHref(state, buildReelListSearchParams, CAMPAIGN_COMMUNICATION_REELS, page)

export const resolveReelListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): {
  state: ReelListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: reelListParamNameSet,
    parse: parseReelListParams,
    buildSearchParams: buildReelListSearchParams,
    basePath: CAMPAIGN_COMMUNICATION_REELS,
    totalPages,
  })
