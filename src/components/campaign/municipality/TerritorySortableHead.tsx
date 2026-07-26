'use client'

import type { ReactNode } from 'react'

import { TerritoryHeaderFilter } from '@/components/campaign/municipality/TerritoryHeaderFilter'
import { CampaignSortableHead } from '@/components/campaign/shared/CampaignSortableHead'
import type { TerritoryFilterOption } from '@/utilities/territoryListFilters'
import {
  buildTerritorySortHref,
  defaultTerritoryListSortDir,
  resolveTerritoryListSort,
  territoryListSortLabels,
  type TerritoryListSortKey,
  type TerritoryListState,
} from '@/utilities/territoryListUrl'

type TerritorySortableHeadProps = {
  state: TerritoryListState
  sortKey: TerritoryListSortKey
  children?: ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
} & (
  | {
      filterParam: 'region'
      filterOptions: TerritoryFilterOption[]
    }
  | {
      filterParam: 'coverage'
      filterOptions?: never
    }
  | {
      filterParam?: never
      filterOptions?: never
    }
)

export const TerritorySortableHead = ({
  state,
  sortKey,
  children,
  align = 'left',
  className,
  filterParam,
  filterOptions,
}: TerritorySortableHeadProps) => {
  const { sort: activeSort, dir } = resolveTerritoryListSort(state)
  const active = activeSort === sortKey
  const nextDir = active ? (dir === 'asc' ? 'desc' : 'asc') : defaultTerritoryListSortDir(sortKey)

  return (
    <CampaignSortableHead
      active={active}
      align={align}
      className={className}
      dir={dir}
      href={buildTerritorySortHref(state, sortKey)}
      nextDir={nextDir}
      sortLabel={territoryListSortLabels[sortKey]}
      filter={
        filterParam === 'region' ? (
          <TerritoryHeaderFilter state={state} filterParam="region" options={filterOptions} />
        ) : filterParam === 'coverage' ? (
          <TerritoryHeaderFilter state={state} filterParam="coverage" />
        ) : null
      }
    >
      {children ?? territoryListSortLabels[sortKey]}
    </CampaignSortableHead>
  )
}
