import { CAMPAIGN_ADVISORS_HOME } from '@/lib/campaignPaths'
import {
  buildListHref,
  firstValue,
  normalizedText,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export type AdvisorListState = {
  page: number
  q?: string
}

export const parseAdvisorListParams = (searchParams: RawSearchParams): AdvisorListState => {
  const q = normalizedText(firstValue(searchParams.q))
  const page = strictDecimalInteger(firstValue(searchParams.page)) ?? 1

  return {
    page,
    ...(q ? { q } : {}),
  }
}

const buildAdvisorListSearchParams = (state: AdvisorListState, page = state.page) => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (page > 1) params.set('page', String(page))
  return params
}

export const advisorListHrefForPage = (state: AdvisorListState, page: number): string =>
  buildListHref(state, buildAdvisorListSearchParams, CAMPAIGN_ADVISORS_HOME, page)
