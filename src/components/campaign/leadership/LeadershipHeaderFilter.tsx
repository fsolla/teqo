'use client'

import { useOptimistic } from 'react'

import {
  CampaignHeaderFilterPopover,
  type CampaignHeaderFilterRow,
} from '@/components/campaign/shared/CampaignHeaderFilterPopover'
import {
  buildLeadershipFilterHref,
  clearLeadershipAccessFilter,
  clearLeadershipMunicipalityFilter,
  clearLeadershipSectorFilter,
  clearLeadershipStatusFilter,
  isLeadershipColumnFilterActive,
  leadershipAccessFilterOptions,
  leadershipSectorFilterOptions,
  leadershipStatusFilterOptions,
  toggleLeadershipAccessFilter,
  toggleLeadershipMunicipalityFilter,
  toggleLeadershipSectorFilter,
  toggleLeadershipStatusFilter,
  type LeadershipFilterOption,
  type LeadershipFilterParam,
} from '@/utilities/leadership/leadershipListFilters'
import { type LeadershipListState } from '@/utilities/leadership/leadershipListUrl'

const FILTER_LABELS: Record<LeadershipFilterParam, string> = {
  supportStatus: 'Status',
  sector: 'Setor',
  municipality: 'Municípios',
  access: 'Acesso ao app',
}

type FilterBranch = {
  options: LeadershipFilterOption[]
  toggle: (state: LeadershipListState, value: string) => LeadershipListState
  clear: (state: LeadershipListState) => LeadershipListState
  selected: (state: LeadershipListState, value: string) => boolean
  checkbox?: boolean
  closeOnChoose?: boolean
}

const resolveFilterBranch = (
  filterParam: LeadershipFilterParam,
  options: LeadershipFilterOption[] | undefined,
): FilterBranch => {
  switch (filterParam) {
    case 'supportStatus':
      return {
        options: leadershipStatusFilterOptions,
        toggle: toggleLeadershipStatusFilter,
        clear: clearLeadershipStatusFilter,
        selected: (state, value) => Boolean(state.statuses?.some((status) => status === value)),
        checkbox: true,
      }
    case 'sector':
      return {
        options: leadershipSectorFilterOptions,
        toggle: toggleLeadershipSectorFilter,
        clear: clearLeadershipSectorFilter,
        selected: (state, value) => Boolean(state.sectors?.some((sector) => sector === value)),
        checkbox: true,
      }
    case 'municipality':
      return {
        options: options ?? [],
        toggle: toggleLeadershipMunicipalityFilter,
        clear: clearLeadershipMunicipalityFilter,
        selected: (state, value) => Boolean(state.municipalities?.includes(Number(value))),
        checkbox: true,
      }
    case 'access':
      return {
        options: leadershipAccessFilterOptions,
        toggle: toggleLeadershipAccessFilter,
        clear: clearLeadershipAccessFilter,
        selected: (state, value) => state.access === value,
        closeOnChoose: true,
      }
  }
}

export const LeadershipHeaderFilter = ({
  state,
  filterParam,
  options,
}: {
  state: LeadershipListState
  filterParam: LeadershipFilterParam
  /** Facet options for Município; closed enums ignore this. */
  options?: LeadershipFilterOption[]
}) => {
  const [viewState, setOptimisticState] = useOptimistic(state)
  const active = isLeadershipColumnFilterActive(viewState, filterParam)
  const branch = resolveFilterBranch(filterParam, options)

  const optionRows: CampaignHeaderFilterRow[] = branch.options.map((option) => {
    const next = branch.toggle(viewState, option.value)
    return {
      value: option.value,
      label: option.label,
      href: buildLeadershipFilterHref(next),
      selected: branch.selected(viewState, option.value),
      ...(branch.checkbox ? { checkbox: true as const } : {}),
      onChoose: () => setOptimisticState(next),
    }
  })

  const cleared = active ? branch.clear(viewState) : null

  return (
    <CampaignHeaderFilterPopover
      id={`leadership-filter-${filterParam}`}
      label={FILTER_LABELS[filterParam]}
      active={active}
      optionRows={optionRows}
      closeOnChoose={branch.closeOnChoose}
      clear={
        cleared
          ? {
              href: buildLeadershipFilterHref(cleared),
              onChoose: () => setOptimisticState(cleared),
            }
          : undefined
      }
    />
  )
}
