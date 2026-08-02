import { CAMPAIGN_ADVISORS_HOME } from '@/lib/campaignPaths'
import {
  allParamValues,
  buildListHref,
  firstValue,
  normalizedText,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export type AdvisorListState = {
  page: number
  q?: string
  municipalities?: number[]
}

export type AdvisorListSearchParams = RawSearchParams

export const advisorListStateToRawParams = (
  state: AdvisorListState,
  page = state.page,
): AdvisorListSearchParams => ({
  page: String(page),
  q: state.q,
  municipality: state.municipalities?.map(String),
})

export const parseAdvisorListParams = (searchParams: RawSearchParams): AdvisorListState => {
  const q = normalizedText(firstValue(searchParams.q))
  const page = strictDecimalInteger(firstValue(searchParams.page)) ?? 1
  const municipalities = allParamValues(searchParams.municipality)
    .map((token) => strictDecimalInteger(token))
    .filter((id): id is number => typeof id === 'number' && id > 0)

  return {
    page,
    ...(q ? { q } : {}),
    ...(municipalities.length ? { municipalities } : {}),
  }
}

const buildAdvisorListSearchParams = (state: AdvisorListState, page = state.page) => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  for (const municipality of state.municipalities ?? []) {
    params.append('municipality', String(municipality))
  }
  if (page > 1) params.set('page', String(page))
  return params
}

export const advisorListHrefForPage = (state: AdvisorListState, page: number): string =>
  buildListHref(state, buildAdvisorListSearchParams, CAMPAIGN_ADVISORS_HOME, page)
