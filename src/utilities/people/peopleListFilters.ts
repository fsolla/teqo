/**
 * People list filter affordances (C100): Capacidade / Município / Apoio
 * toggles, active-filter summary and clear-filters. Multi-select facets are OR
 * within the facet, like every other list.
 */
import { leadershipSupportStatuses } from '@/lib/schemas/leadership'
import { truncatedNamesLabel } from '@/utilities/campaignListUrl'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'
import { PEOPLE_CAPACITIES, peopleCapacityLabels } from '@/utilities/people/peopleLabels'
import {
  buildPeopleListHref,
  parsePeopleListParams,
  PEOPLE_ABSENCES,
  peopleAbsenceLabels,
  peopleListStateToRawParams,
  type PeopleListState,
} from '@/utilities/people/peopleListUrl'

export type PeopleFilterOption = {
  value: string
  label: string
}

type PeopleMultiFilterParam = 'capacity' | 'municipality' | 'status' | 'ausencia' | 'party'

export const peopleCapacityFilterOptions: PeopleFilterOption[] = PEOPLE_CAPACITIES.map((value) => ({
  value,
  label: peopleCapacityLabels[value],
}))

export const peopleStatusFilterOptions: PeopleFilterOption[] = leadershipSupportStatuses.map(
  (value) => ({ value, label: supportStatusLabels[value] }),
)

export const peopleAbsenceFilterOptions: PeopleFilterOption[] = PEOPLE_ABSENCES.map((value) => ({
  value,
  label: peopleAbsenceLabels[value],
}))

/**
 * Writes the RAW param and lets `parsePeopleListParams` validate, so no branch
 * has to cast a `string[]` into the state's narrow value types.
 */
const setPeopleMultiFilterValues = (
  state: PeopleListState,
  param: PeopleMultiFilterParam,
  values: string[],
): PeopleListState =>
  parsePeopleListParams({
    ...peopleListStateToRawParams({ ...state, page: 1 }, 1),
    [param]: values,
  })

const getPeopleMultiFilterValues = (
  state: PeopleListState,
  param: PeopleMultiFilterParam,
): string[] => {
  if (param === 'capacity') return state.capacities ?? []
  if (param === 'status') return state.statuses ?? []
  if (param === 'ausencia') return state.ausencias ?? []
  if (param === 'party') return state.parties ?? []
  return (state.municipalities ?? []).map(String)
}

const togglePeopleMultiFilterValue = (
  state: PeopleListState,
  param: PeopleMultiFilterParam,
  value: string,
): PeopleListState => {
  const current = getPeopleMultiFilterValues(state, param)
  return setPeopleMultiFilterValues(
    state,
    param,
    current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
  )
}

export const togglePeopleCapacityFilter = (
  state: PeopleListState,
  value: string,
): PeopleListState => {
  if (!PEOPLE_CAPACITIES.some((capacity) => capacity === value)) return state
  return togglePeopleMultiFilterValue(state, 'capacity', value)
}

export const togglePeopleMunicipalityFilter = (
  state: PeopleListState,
  value: string,
): PeopleListState => {
  if (!/^[1-9]\d*$/.test(value)) return state
  return togglePeopleMultiFilterValue(state, 'municipality', value)
}

export const togglePeopleStatusFilter = (
  state: PeopleListState,
  value: string,
): PeopleListState => {
  if (!leadershipSupportStatuses.some((status) => status === value)) return state
  return togglePeopleMultiFilterValue(state, 'status', value)
}

export const togglePeopleAbsenceFilter = (
  state: PeopleListState,
  value: string,
): PeopleListState => {
  if (!PEOPLE_ABSENCES.some((absence) => absence === value)) return state
  return togglePeopleMultiFilterValue(state, 'ausencia', value)
}

/**
 * C130 — party is FREE TEXT on `stateDeputy.party` (maxLength 32), so the
 * toggle validates structurally (non-empty, ≤ 32 chars) and lets
 * `parsePeopleListParams` dedupe — the municipalities facet precedent.
 */
export const togglePeoplePartyFilter = (state: PeopleListState, value: string): PeopleListState => {
  const normalized = value.trim()
  if (!normalized || normalized.length > 32) return state
  return togglePeopleMultiFilterValue(state, 'party', normalized)
}

/** Drop every filter and the search; keep the ordering (municipios precedent). */
export const clearPeopleListFilters = (state: PeopleListState): PeopleListState => ({
  page: 1,
  sort: state.sort,
  dir: state.dir,
})

export const buildPeopleFilterHref = (next: PeopleListState): string => buildPeopleListHref(next, 1)

const municipalityLabel = (
  id: number,
  labels?: ReadonlyMap<number, string> | Readonly<Record<number, string>>,
): string => {
  if (!labels) return `Município #${id}`
  if (labels instanceof Map) return labels.get(id) ?? `Município #${id}`
  const record = labels as Readonly<Record<number, string>>
  return record[id] ?? `Município #${id}`
}

export const formatPeopleActiveFiltersSummary = (
  state: PeopleListState,
  municipalityLabelsById?: ReadonlyMap<number, string> | Readonly<Record<number, string>>,
): string | null => {
  const parts: string[] = []
  if (state.capacities?.length) {
    parts.push(
      truncatedNamesLabel(state.capacities.map((capacity) => peopleCapacityLabels[capacity])),
    )
  }
  if (state.municipalities?.length) {
    parts.push(
      truncatedNamesLabel(
        state.municipalities.map((id) => municipalityLabel(id, municipalityLabelsById)),
      ),
    )
  }
  if (state.statuses?.length) {
    parts.push(truncatedNamesLabel(state.statuses.map((status) => supportStatusLabels[status])))
  }
  if (state.ausencias?.length) {
    parts.push(truncatedNamesLabel(state.ausencias.map((absence) => peopleAbsenceLabels[absence])))
  }
  if (state.parties?.length) {
    parts.push(truncatedNamesLabel(state.parties))
  }
  if (state.q) parts.push(`Busca "${state.q}"`)
  return parts.length ? parts.join(' · ') : null
}
