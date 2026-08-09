/**
 * State deputy ("dobradinha") list filter affordances: Partido toggle, active
 * filter summary and clear-filters. Mirrors `territoryListFilters.ts`; only
 * one filterable column exists, so there is no B16+-style href fast path —
 * `stateDeputy` runs in the dozens of rows, not 435.
 */
import { NO_PARTY_FILTER_VALUE, truncatedNamesLabel } from '@/utilities/campaignListUrl'
import {
  buildStateDeputyListHref,
  parseStateDeputyListParams,
  stateDeputyListStateToRawParams,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

export type StateDeputyFilterOption = {
  value: string
  label: string
}

const noPartyFilterLabel = 'Sem partido'

/**
 * Appends the "Sem partido" sentinel row to the facet-derived options —
 * shared by the desktop popover (`StateDeputyHeaderFilter`) and the mobile
 * filter bar (`StateDeputyFilters`) so the row is built once, not twice.
 */
export const buildStateDeputyPartyOptions = (
  options: readonly StateDeputyFilterOption[],
  hasNoParty: boolean,
): StateDeputyFilterOption[] =>
  hasNoParty
    ? [...options, { value: NO_PARTY_FILTER_VALUE, label: noPartyFilterLabel }]
    : [...options]

export const toggleStateDeputyPartyFilter = (
  state: StateDeputyListState,
  value: string,
): StateDeputyListState => {
  const current = state.parties ?? []
  const parties = current.includes(value)
    ? current.filter((party) => party !== value)
    : [...current, value]
  return parseStateDeputyListParams({
    ...stateDeputyListStateToRawParams({ ...state, page: 1 }, 1),
    party: parties,
  })
}

/** Per-column clear (the header popover's "Limpar") — keeps the search and sort. */
export const clearStateDeputyPartyFilter = (state: StateDeputyListState): StateDeputyListState =>
  parseStateDeputyListParams({
    ...stateDeputyListStateToRawParams({ ...state, page: 1 }, 1),
    party: undefined,
  })

/**
 * The global "Limpar" contract shared by the mobile filter bar and the empty
 * state: drop every filter and the search, keep the sort — same shape as
 * `clearMunicipalityListFilters`.
 */
export const clearStateDeputyListFilters = (state: StateDeputyListState): StateDeputyListState => ({
  page: 1,
  sort: state.sort,
  dir: state.dir,
})

/**
 * Every filter change resets pagination, so the page-1 pin belongs here rather
 * than at each call site — sibling of `buildMunicipalityFilterHref`.
 */
export const buildStateDeputyFilterHref = (next: StateDeputyListState): string =>
  buildStateDeputyListHref(next, 1)

export const isStateDeputyPartyFilterActive = (state: StateDeputyListState): boolean =>
  Boolean(state.parties?.length)

export const formatStateDeputyActiveFiltersSummary = (
  state: StateDeputyListState,
): string | null => {
  const parts: string[] = []
  if (state.parties?.length) {
    parts.push(
      truncatedNamesLabel(
        state.parties.map((party) =>
          party === NO_PARTY_FILTER_VALUE ? noPartyFilterLabel : party,
        ),
      ),
    )
  }
  if (state.q) parts.push(`Busca "${state.q}"`)
  return parts.length ? parts.join(' · ') : null
}
