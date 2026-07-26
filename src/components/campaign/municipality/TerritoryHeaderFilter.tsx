'use client'

import { useOptimistic } from 'react'

import {
  CampaignHeaderFilterPopover,
  type CampaignHeaderFilterRow,
} from '@/components/campaign/shared/CampaignHeaderFilterPopover'
import {
  isTerritoryFilterActive,
  territoryCoverageOptions,
  toggleTerritoryCoverageFilter,
  toggleTerritoryRegionFilter,
  type TerritoryFilterOption,
} from '@/utilities/territoryListFilters'
import { buildTerritoryListHref, type TerritoryListState } from '@/utilities/territoryListUrl'

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
            href: buildTerritoryListHref(next),
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
            href: buildTerritoryListHref(next),
            selected: viewState.coverage === option.value,
            checkbox: false,
            onChoose: () => setOptimisticState(next),
          }
        })

  const clearedState: TerritoryListState =
    filterParam === 'region'
      ? { ...viewState, regions: undefined }
      : { ...viewState, coverage: undefined }

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
              href: buildTerritoryListHref(clearedState),
              onChoose: () => setOptimisticState(clearedState),
            }
          : undefined
      }
    />
  )
}
