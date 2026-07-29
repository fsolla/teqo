/**
 * Leadership list filter affordances: Status / Setor / Município / Acesso
 * toggles, active-filter summary and clear-filters.
 */
import { leadershipSectors, leadershipSupportStatuses } from '@/lib/schemas/leadership'
import { strictDecimalInteger, truncatedNamesLabel } from '@/utilities/campaignListUrl'
import {
  leadershipAccessFilterLabels,
  supportStatusLabels,
} from '@/utilities/leadership/leadershipLabels'
import {
  buildLeadershipListHref,
  leadershipListStateToRawParams,
  parseLeadershipListParams,
  type LeadershipListState,
} from '@/utilities/leadership/leadershipListUrl'
import { leadershipSectorLabels } from '@/utilities/leadership/leadershipUi'

export type LeadershipFilterParam = 'supportStatus' | 'sector' | 'municipality' | 'access'

export type LeadershipFilterOption = {
  value: string
  label: string
}

type LeadershipMultiFilterParam = 'status' | 'sector' | 'municipality'

export const leadershipStatusFilterOptions: LeadershipFilterOption[] =
  leadershipSupportStatuses.map((value) => ({ value, label: supportStatusLabels[value] }))

export const leadershipSectorFilterOptions: LeadershipFilterOption[] = leadershipSectors.map(
  (value) => ({ value, label: leadershipSectorLabels[value] }),
)

export const leadershipAccessFilterOptions: LeadershipFilterOption[] = (
  Object.keys(leadershipAccessFilterLabels) as Array<keyof typeof leadershipAccessFilterLabels>
).map((value) => ({ value, label: leadershipAccessFilterLabels[value] }))

const withLeadershipListPageReset = (state: LeadershipListState): LeadershipListState =>
  parseLeadershipListParams(leadershipListStateToRawParams({ ...state, page: 1 }, 1))

/**
 * Writes the RAW param and lets `parseLeadershipListParams` validate, so no
 * branch has to cast a `string[]` into the state's narrow value types.
 */
const setLeadershipMultiFilterValues = (
  state: LeadershipListState,
  param: LeadershipMultiFilterParam,
  values: string[],
): LeadershipListState =>
  parseLeadershipListParams({
    ...leadershipListStateToRawParams({ ...state, page: 1 }, 1),
    [param]: values,
  })

const getLeadershipMultiFilterValues = (
  state: LeadershipListState,
  param: LeadershipMultiFilterParam,
): string[] => {
  if (param === 'status') return state.statuses ?? []
  if (param === 'sector') return state.sectors ?? []
  return (state.municipalities ?? []).map(String)
}

const toggleLeadershipMultiFilterValue = (
  state: LeadershipListState,
  param: LeadershipMultiFilterParam,
  value: string,
): LeadershipListState => {
  const current = getLeadershipMultiFilterValues(state, param)
  return setLeadershipMultiFilterValues(
    state,
    param,
    current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
  )
}

export const toggleLeadershipStatusFilter = (
  state: LeadershipListState,
  value: string,
): LeadershipListState => toggleLeadershipMultiFilterValue(state, 'status', value)

export const clearLeadershipStatusFilter = (state: LeadershipListState): LeadershipListState =>
  setLeadershipMultiFilterValues(state, 'status', [])

export const toggleLeadershipSectorFilter = (
  state: LeadershipListState,
  value: string,
): LeadershipListState => toggleLeadershipMultiFilterValue(state, 'sector', value)

export const clearLeadershipSectorFilter = (state: LeadershipListState): LeadershipListState =>
  setLeadershipMultiFilterValues(state, 'sector', [])

export const toggleLeadershipMunicipalityFilter = (
  state: LeadershipListState,
  value: string,
): LeadershipListState => {
  if (strictDecimalInteger(value) === undefined) return state
  return toggleLeadershipMultiFilterValue(state, 'municipality', value)
}

export const clearLeadershipMunicipalityFilter = (
  state: LeadershipListState,
): LeadershipListState => setLeadershipMultiFilterValues(state, 'municipality', [])

/** Exclusive toggle — selecting the active value clears; selecting the other replaces. */
export const toggleLeadershipAccessFilter = (
  state: LeadershipListState,
  value: string,
): LeadershipListState => {
  if (value !== 'com' && value !== 'sem') return state
  return withLeadershipListPageReset({
    ...state,
    access: state.access === value ? undefined : value,
  })
}

export const clearLeadershipAccessFilter = (state: LeadershipListState): LeadershipListState =>
  withLeadershipListPageReset({ ...state, access: undefined })

/** Drop every filter and the search; keep the sort. */
export const clearLeadershipListFilters = (state: LeadershipListState): LeadershipListState => ({
  page: 1,
  sort: state.sort,
  dir: state.dir,
})

export const buildLeadershipFilterHref = (next: LeadershipListState): string =>
  buildLeadershipListHref(next, 1)

export const isLeadershipColumnFilterActive = (
  state: LeadershipListState,
  filterParam: LeadershipFilterParam,
): boolean => {
  switch (filterParam) {
    case 'supportStatus':
      return Boolean(state.statuses?.length)
    case 'sector':
      return Boolean(state.sectors?.length)
    case 'municipality':
      return Boolean(state.municipalities?.length)
    case 'access':
      return Boolean(state.access)
  }
}

const municipalityLabel = (
  id: number,
  labels?: ReadonlyMap<number, string> | Readonly<Record<number, string>>,
): string => {
  if (!labels) return `Município #${id}`
  if (labels instanceof Map) return labels.get(id) ?? `Município #${id}`
  const record = labels as Readonly<Record<number, string>>
  return record[id] ?? `Município #${id}`
}

export const formatLeadershipActiveFiltersSummary = (
  state: LeadershipListState,
  municipalityLabelsById?: ReadonlyMap<number, string> | Readonly<Record<number, string>>,
): string | null => {
  const parts: string[] = []
  if (state.statuses?.length) {
    parts.push(truncatedNamesLabel(state.statuses.map((status) => supportStatusLabels[status])))
  }
  if (state.sectors?.length) {
    parts.push(truncatedNamesLabel(state.sectors.map((sector) => leadershipSectorLabels[sector])))
  }
  if (state.municipalities?.length) {
    parts.push(
      truncatedNamesLabel(
        state.municipalities.map((id) => municipalityLabel(id, municipalityLabelsById)),
      ),
    )
  }
  if (state.access) parts.push(leadershipAccessFilterLabels[state.access])
  if (state.q) parts.push(`Busca "${state.q}"`)
  return parts.length ? parts.join(' · ') : null
}
