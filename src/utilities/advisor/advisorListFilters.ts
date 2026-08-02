/**
 * Advisor list filter affordances: município (carteira) toggles and clear.
 */
import { strictDecimalInteger } from '@/utilities/campaignListUrl'
import {
  advisorListHrefForPage,
  advisorListStateToRawParams,
  parseAdvisorListParams,
  type AdvisorListState,
} from '@/utilities/advisor/advisorListUrl'

export type AdvisorFilterOption = {
  value: string
  label: string
}

const setAdvisorMunicipalityFilterValues = (
  state: AdvisorListState,
  values: string[],
): AdvisorListState =>
  parseAdvisorListParams({
    ...advisorListStateToRawParams({ ...state, page: 1 }, 1),
    municipality: values,
  })

const getAdvisorMunicipalityFilterValues = (state: AdvisorListState): string[] =>
  (state.municipalities ?? []).map(String)

export const toggleAdvisorMunicipalityFilter = (
  state: AdvisorListState,
  value: string,
): AdvisorListState => {
  if (strictDecimalInteger(value) === undefined) return state
  const current = getAdvisorMunicipalityFilterValues(state)
  return setAdvisorMunicipalityFilterValues(
    state,
    current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
  )
}

export const clearAdvisorMunicipalityFilter = (state: AdvisorListState): AdvisorListState =>
  setAdvisorMunicipalityFilterValues(state, [])

/** Drop every filter and the search; keep pagination at page 1. */
export const clearAdvisorListFilters = (): AdvisorListState => ({
  page: 1,
})

export const buildAdvisorFilterHref = (next: AdvisorListState): string =>
  advisorListHrefForPage(next, 1)

export const isAdvisorMunicipalityFilterActive = (state: AdvisorListState): boolean =>
  Boolean(state.municipalities?.length)
