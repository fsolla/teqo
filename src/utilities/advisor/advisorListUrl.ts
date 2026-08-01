/**
 * Advisor list URL contract: state, param parse/canonicalize and hrefs.
 * Own module (same shape as `leadershipListUrl`) — list params only; loaders
 * stay in `advisorData.ts`.
 */
import { ADVISOR_QUICK_CREATE_PARAM } from '@/lib/campaignAdvisorQuickActions'
import { CAMPAIGN_ADVISORS_HOME } from '@/lib/campaignPaths'
import {
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export type AdvisorListState = {
  page: number
  q?: string
  /** B87 quick-create — preserved through canonical redirect when `criar=1`. */
  autoCreateDraft?: boolean
}

export type AdvisorListSearchParams = RawSearchParams

const advisorListParamNames = ['q', 'page', ADVISOR_QUICK_CREATE_PARAM] as const
const advisorListParamNameSet = new Set<string>(advisorListParamNames)

export const parseAdvisorListParams = (params: AdvisorListSearchParams): AdvisorListState => {
  const q = normalizedText(firstValue(params.q))
  const page = strictDecimalInteger(firstValue(params.page)) ?? 1
  const autoCreateDraft = firstValue(params[ADVISOR_QUICK_CREATE_PARAM]) === '1'

  return {
    page,
    ...(q ? { q } : {}),
    ...(autoCreateDraft ? { autoCreateDraft: true } : {}),
  }
}

export const advisorListStateToRawParams = (
  state: AdvisorListState,
  page = state.page,
): AdvisorListSearchParams => ({
  page: String(page),
  q: state.q,
  ...(state.autoCreateDraft ? { [ADVISOR_QUICK_CREATE_PARAM]: '1' } : {}),
})

export const serializeCanonicalAdvisorListSearchParams = (
  canonicalState: AdvisorListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (canonicalState.q) params.set('q', canonicalState.q)
  if (canonicalState.autoCreateDraft) params.set(ADVISOR_QUICK_CREATE_PARAM, '1')
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))
  return params
}

const buildAdvisorListSearchParams = (
  state: AdvisorListState,
  page = state.page,
): URLSearchParams =>
  serializeCanonicalAdvisorListSearchParams(
    parseAdvisorListParams(advisorListStateToRawParams(state, page)),
  )

/** Pagination / filter hrefs drop the one-shot quick-create flag. */
export const advisorListHrefForPage = (state: AdvisorListState, page: number): string =>
  buildListHref(
    { page: state.page, ...(state.q ? { q: state.q } : {}) },
    buildAdvisorListSearchParams,
    CAMPAIGN_ADVISORS_HOME,
    page,
  )

export const resolveAdvisorListUrl = (
  params: AdvisorListSearchParams,
  totalPages?: number,
): {
  state: AdvisorListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: advisorListParamNameSet,
    parse: parseAdvisorListParams,
    buildSearchParams: (state) => buildAdvisorListSearchParams(state),
    basePath: CAMPAIGN_ADVISORS_HOME,
    totalPages,
  })
