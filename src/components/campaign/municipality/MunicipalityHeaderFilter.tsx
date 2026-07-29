'use client'

import { useOptimistic } from 'react'

import {
  CampaignHeaderFilterPopover,
  type CampaignHeaderFilterRow,
} from '@/components/campaign/shared/CampaignHeaderFilterPopover'
import { municipalityPriorityLabels } from '@/utilities/municipality/municipalityLabels'
import {
  buildMunicipalityFilterHref,
  buildMunicipalityFilterOptionHref,
  clearMunicipalityAdvisorFilters,
  clearMunicipalityMultiFilter,
  clearMunicipalityNameFilters,
  getMunicipalityFilterDefinition,
  getMunicipalityMultiFilterValues,
  isMunicipalityColumnFilterActive,
  municipalityFilterOptionsForSlugs,
  toggleMunicipalityExclusiveFilterValue,
  toggleMunicipalityMultiFilterValue,
  toggleMunicipalityPriorityFilter,
  type MunicipalityFilterOption,
  type MunicipalityFilterParam,
  type MunicipalityMultiFilterParam,
} from '@/utilities/municipality/municipalityListFilters'
import { type MunicipalityListState } from '@/utilities/municipality/municipalityListUrl'

type MunicipalityHeaderFilterProps = {
  state: MunicipalityListState
  filterParam: MunicipalityFilterParam
  /**
   * Options already narrowed by the other active filters (server-computed).
   * The Município column ships bare slugs — labels come from the catalog here
   * on the client, so the RSC payload never carries 435 name pairs (B16+).
   */
  options?: MunicipalityFilterOption[] | readonly string[]
  /** Staff-only Prioritária checkbox inside the Município filter. */
  showPriorityFilter?: boolean
}

const multiParamByFilter = {
  name: 'slug',
  region: 'region',
  advisor: 'advisor',
  trend: 'trend',
  class: 'class',
  level: 'level',
  coverage: null,
} as const satisfies Record<MunicipalityFilterParam, MunicipalityMultiFilterParam | null>

export const MunicipalityHeaderFilter = ({
  state,
  filterParam,
  options: optionsInput,
  showPriorityFilter = false,
}: MunicipalityHeaderFilterProps) => {
  /**
   * Optimistic selection: set inside the navigation transition (see
   * `CampaignTransitionAnchor.onNavigate`), so React shows the clicked state
   * immediately and discards it for the server truth when the transition
   * settles — no manual base-key bookkeeping, no reverting a pending click.
   */
  const [viewState, setOptimisticState] = useOptimistic(state)

  const definition = getMunicipalityFilterDefinition(filterParam)
  const definitionOptions = definition.options
  const options = !optionsInput
    ? (definitionOptions ?? [])
    : typeof optionsInput[0] === 'string' || optionsInput.length === 0
      ? municipalityFilterOptionsForSlugs(optionsInput as readonly string[])
      : (optionsInput as MunicipalityFilterOption[])
  const isActive = isMunicipalityColumnFilterActive(viewState, filterParam)

  const commit = (next: MunicipalityListState) => {
    setOptimisticState(next)
  }

  const multiParam = multiParamByFilter[filterParam]
  const selectedMulti = multiParam ? getMunicipalityMultiFilterValues(viewState, multiParam) : []

  /**
   * Exclusive rows above the multi-select list: the Município column also owns
   * "Prioritária", and the Assessores column owns the com/sem assessor toggle
   * (it absorbed the former "Assessoria" column).
   */
  const exclusiveRows =
    filterParam === 'name' && showPriorityFilter
      ? [
          {
            label: municipalityPriorityLabels.alta,
            selected: viewState.priority === 'alta',
            next: toggleMunicipalityPriorityFilter(viewState),
          },
        ]
      : filterParam === 'advisor'
        ? (getMunicipalityFilterDefinition('coverage').options ?? []).map((option) => ({
            label: option.label,
            selected: viewState.coverage === option.value,
            next: toggleMunicipalityExclusiveFilterValue(viewState, 'coverage', option.value),
          }))
        : []

  const clearedState =
    filterParam === 'name'
      ? clearMunicipalityNameFilters(viewState)
      : filterParam === 'advisor'
        ? clearMunicipalityAdvisorFilters(viewState)
        : multiParam
          ? clearMunicipalityMultiFilter(viewState, multiParam)
          : viewState

  const hasSelection = selectedMulti.length > 0 || exclusiveRows.some((row) => row.selected)
  const sharedExclusiveRows: CampaignHeaderFilterRow[] = exclusiveRows.map((row) => ({
    value: row.label,
    label: row.label,
    href: buildMunicipalityFilterHref(row.next),
    selected: row.selected,
    checkbox: true,
    onChoose: () => commit(row.next),
  }))

  const multiRows: CampaignHeaderFilterRow[] = multiParam
    ? options.map((option) => ({
        value: option.value,
        label: option.label,
        href: buildMunicipalityFilterOptionHref(viewState, multiParam, option.value),
        selected: selectedMulti.includes(option.value),
        checkbox: true,
        onChoose: () =>
          commit(toggleMunicipalityMultiFilterValue(viewState, multiParam, option.value)),
      }))
    : []

  return (
    <CampaignHeaderFilterPopover
      id={`municipality-filter-${filterParam}`}
      label={definition.label}
      active={isActive}
      closeOnChoose={definition.selection !== 'multi'}
      exclusiveRows={sharedExclusiveRows}
      optionRows={multiRows}
      clear={
        hasSelection
          ? {
              href: buildMunicipalityFilterHref(clearedState),
              onChoose: () => commit(clearedState),
            }
          : undefined
      }
    />
  )
}
