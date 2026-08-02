/**
 * Pure option/chip catalog for the mobile municipality filter combobox (B120).
 * URL contract stays in `municipalityListFilters` / `municipalityListUrl` (B18).
 */
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  VOTE_ESTIMATE_SCENARIOS,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'
import { municipalityPriorityLabels } from '@/utilities/municipality/municipalityLabels'
import {
  getMunicipalityMultiFilterValues,
  municipalityFilterDefinitions,
  toggleMunicipalityExclusiveFilterValue,
  toggleMunicipalityMultiFilterValue,
  toggleMunicipalityPriorityFilter,
  type MunicipalityFilterOption,
  type MunicipalityMultiFilterParam,
} from '@/utilities/municipality/municipalityListFilters'
import {
  municipalityListSortOptions,
  resolveMunicipalityListSort,
  serializeMunicipalitySortValue,
  type MunicipalityListSortDirection,
  type MunicipalityListSortKey,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'

export type MunicipalityMobileFilterChip = {
  id: string
  label: string
}

export type MunicipalityMobileFilterOption =
  | {
      id: string
      kind: 'priority'
      label: string
      active: boolean
    }
  | {
      id: string
      kind: 'multi'
      label: string
      param: MunicipalityMultiFilterParam
      value: string
      active: boolean
    }
  | {
      id: string
      kind: 'coverage'
      label: string
      value: string
      active: boolean
    }
  | {
      id: string
      kind: 'sort'
      label: string
      sort: MunicipalityListSortKey
      dir: MunicipalityListSortDirection
      active: boolean
    }
  | {
      id: string
      kind: 'scenario'
      label: string
      scenario: VoteEstimateScenario
      active: boolean
    }

const dimensionLabel = (dimension: string, option: string): string => `${dimension} · ${option}`

export type BuildMunicipalityMobileFilterOptionsArgs = {
  state: MunicipalityListState
  showStaffFilters: boolean
  regionFilterOptions: MunicipalityFilterOption[]
  advisorFilterOptions: MunicipalityFilterOption[]
  /** Client-only estimate scenario (not in the URL). */
  scenario: VoteEstimateScenario
}

export const buildMunicipalityMobileFilterOptions = ({
  state,
  showStaffFilters,
  regionFilterOptions,
  advisorFilterOptions,
  scenario,
}: BuildMunicipalityMobileFilterOptionsArgs): MunicipalityMobileFilterOption[] => {
  const options: MunicipalityMobileFilterOption[] = []
  const { sort: activeSort, dir: activeDir } = resolveMunicipalityListSort(state)

  if (showStaffFilters) {
    options.push({
      id: 'priority:alta',
      kind: 'priority',
      label: dimensionLabel('Prioridade', municipalityPriorityLabels.alta),
      active: state.priority === 'alta',
    })
  }

  for (const definition of municipalityFilterDefinitions) {
    if (definition.param === 'name') continue
    if (definition.staffOnly && !showStaffFilters) continue

    if (definition.selection === 'multi') {
      let filterOptions = definition.options ?? []
      if (definition.param === 'region') filterOptions = regionFilterOptions
      if (definition.param === 'advisor') filterOptions = advisorFilterOptions
      if (filterOptions.length === 0) continue

      let param: MunicipalityMultiFilterParam
      if (definition.param === 'region') param = 'region'
      else if (definition.param === 'advisor') param = 'advisor'
      else if (definition.param === 'trend') param = 'trend'
      else if (definition.param === 'class') param = 'class'
      else if (definition.param === 'level') param = 'level'
      else continue // `name` skipped above; `coverage` is toggle-only

      const selected = new Set(getMunicipalityMultiFilterValues(state, param))
      for (const option of filterOptions) {
        options.push({
          id: `multi:${param}:${option.value}`,
          kind: 'multi',
          label: dimensionLabel(definition.label, option.label),
          param,
          value: option.value,
          active: selected.has(option.value),
        })
      }
      continue
    }

    if (definition.selection === 'toggle' && definition.param === 'coverage') {
      for (const option of definition.options ?? []) {
        options.push({
          id: `coverage:${option.value}`,
          kind: 'coverage',
          label: dimensionLabel(definition.label, option.label),
          value: option.value,
          active: state.coverage === option.value,
        })
      }
    }
  }

  for (const sortOption of municipalityListSortOptions) {
    const value = serializeMunicipalitySortValue(sortOption.key, sortOption.dir)
    options.push({
      id: `sort:${value}`,
      kind: 'sort',
      label: dimensionLabel('Ordenar', sortOption.label),
      sort: sortOption.key,
      dir: sortOption.dir,
      active: sortOption.key === activeSort && sortOption.dir === activeDir,
    })
  }

  if (showStaffFilters) {
    for (const estimateScenario of VOTE_ESTIMATE_SCENARIOS) {
      options.push({
        id: `scenario:${estimateScenario}`,
        kind: 'scenario',
        label: dimensionLabel('Cenário', voteEstimateScenarioLabels[estimateScenario]),
        scenario: estimateScenario,
        active: scenario === estimateScenario,
      })
    }
  }

  return options
}

/**
 * Active filter chips. Sort only when the URL overrides the default (B18 drops
 * the default from the query); scenario only when not central.
 */
export const buildMunicipalityMobileFilterChips = (
  state: MunicipalityListState,
  options: readonly MunicipalityMobileFilterOption[],
): MunicipalityMobileFilterChip[] => {
  const chips: MunicipalityMobileFilterChip[] = []
  let sortChip: MunicipalityMobileFilterChip | null = null
  let scenarioChip: MunicipalityMobileFilterChip | null = null
  const sortOverridden = state.sort !== undefined || state.dir !== undefined

  for (const option of options) {
    if (!option.active) continue
    if (option.kind === 'sort') {
      if (sortOverridden) sortChip = { id: option.id, label: option.label }
      continue
    }
    if (option.kind === 'scenario') {
      if (option.scenario !== DEFAULT_VOTE_ESTIMATE_SCENARIO) {
        scenarioChip = { id: option.id, label: option.label }
      }
      continue
    }
    chips.push({ id: option.id, label: option.label })
  }

  if (sortChip) chips.push(sortChip)
  if (scenarioChip) chips.push(scenarioChip)
  return chips
}

/** Chip dismiss: filters toggle off; sort/scenario reset to defaults. */
export const dismissMunicipalityMobileFilterChip = (
  state: MunicipalityListState,
  option: MunicipalityMobileFilterOption,
): MunicipalityListState | 'scenario-default' => {
  switch (option.kind) {
    case 'sort':
      return { ...state, page: 1, sort: undefined, dir: undefined }
    case 'scenario':
      return 'scenario-default'
    case 'priority':
    case 'multi':
    case 'coverage': {
      const next = applyMunicipalityMobileFilterOption(state, option)
      if (next === 'scenario') {
        throw new Error(`Unexpected scenario result for ${option.kind}`)
      }
      return next
    }
    default: {
      const _exhaustive: never = option
      return _exhaustive
    }
  }
}

/**
 * Applies a typeahead pick (or chip dismiss) to list state. Scenario is not
 * URL-backed — callers handle it via the estimate-scenario context.
 */
export const applyMunicipalityMobileFilterOption = (
  state: MunicipalityListState,
  option: MunicipalityMobileFilterOption,
): MunicipalityListState | 'scenario' => {
  switch (option.kind) {
    case 'priority':
      return toggleMunicipalityPriorityFilter(state)
    case 'multi':
      return toggleMunicipalityMultiFilterValue(state, option.param, option.value)
    case 'coverage':
      return toggleMunicipalityExclusiveFilterValue(state, 'coverage', option.value)
    case 'sort':
      return { ...state, page: 1, sort: option.sort, dir: option.dir }
    case 'scenario':
      return 'scenario'
    default: {
      const _exhaustive: never = option
      return _exhaustive
    }
  }
}

export const findMunicipalityMobileFilterOption = (
  options: readonly MunicipalityMobileFilterOption[],
  id: string,
): MunicipalityMobileFilterOption | undefined => options.find((option) => option.id === id)
