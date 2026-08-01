'use client'

import { useOptimistic } from 'react'

import {
  CampaignHeaderFilterPopover,
  type CampaignHeaderFilterRow,
} from '@/components/campaign/shared/CampaignHeaderFilterPopover'
import {
  buildTerritoryFilterHref,
  isTerritoryFilterActive,
  territoryCoverageOptions,
  toggleTerritoryCoverageFilter,
  toggleTerritoryRegionFilter,
  type TerritoryFilterOption,
} from '@/utilities/territory/territoryListFilters'
import { type TerritoryListState } from '@/utilities/territory/territoryListUrl'

type TerritoryHeaderFilterProps =
  | {
      state: TerritoryListState
      filterParam: 'region'
      options: TerritoryFilterOption[]
    }
  | {
      state: TerritoryListState
      filterParam: 'coverage'
      options?: never
    }

export const TerritoryHeaderFilter = ({
  state,
  filterParam,
  options,
}: TerritoryHeaderFilterProps) => {
  const [viewState, setOptimisticState] = useOptimistic(state)
  const active = isTerritoryFilterActive(viewState, filterParam)

  const rows: CampaignHeaderFilterRow[] =
    filterParam === 'region'
      ? options.map((option) => {
          const next = toggleTerritoryRegionFilter(viewState, option.value)
          return {
            value: option.value,
            label: option.label,
            href: buildTerritoryFilterHref(next),
            selected: Boolean(viewState.regions?.some((region) => region === option.value)),
            checkbox: true,
            onChoose: () => setOptimisticState(next),
          }
        })
      : territoryCoverageOptions.map((option) => {
          const next = toggleTerritoryCoverageFilter(viewState, option.value)
          return {
            value: option.value,
            label: option.label,
            href: buildTerritoryFilterHref(next),
            selected: viewState.coverage === option.value,
            checkbox: false,
            onChoose: () => setOptimisticState(next),
          }
        })

  const clearedState: TerritoryListState =
    filterParam === 'region'
      ? { ...viewState, regions: undefined, page: 1 }
      : { ...viewState, coverage: undefined, page: 1 }

  return (
    <CampaignHeaderFilterPopover
      id={`territory-filter-${filterParam}`}
      label={filterParam === 'region' ? 'Território' : 'Assessoria'}
      active={active}
      closeOnChoose={filterParam === 'coverage'}
      optionRows={rows}
      clear={
        active
          ? {
              href: buildTerritoryFilterHref(clearedState),
              onChoose: () => setOptimisticState(clearedState),
            }
          : undefined
      }
    />
  )
}
