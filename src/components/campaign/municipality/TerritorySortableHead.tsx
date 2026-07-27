'use client'

import type { ReactNode } from 'react'

import { TerritoryHeaderFilter } from '@/components/campaign/municipality/TerritoryHeaderFilter'
import {
  CampaignHoverTooltip,
  campaignHoverExplanationClassName,
  campaignHoverTooltipAlign,
} from '@/components/campaign/shared/CampaignHoverTooltip'
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
  description?: ReactNode
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
  description,
  align = 'left',
  className,
  filterParam,
  filterOptions,
}: TerritorySortableHeadProps) => {
  const { sort: activeSort, dir } = resolveTerritoryListSort(state)
  const active = activeSort === sortKey
  const nextDir = active ? (dir === 'asc' ? 'desc' : 'asc') : defaultTerritoryListSortDir(sortKey)
  const label = children ?? territoryListSortLabels[sortKey]

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
      wrapSortControl={
        description
          ? (control) => (
              <CampaignHoverTooltip content={description} align={campaignHoverTooltipAlign(align)}>
                {control}
              </CampaignHoverTooltip>
            )
          : undefined
      }
    >
      {description ? <span className={campaignHoverExplanationClassName}>{label}</span> : label}
    </CampaignSortableHead>
  )
}
