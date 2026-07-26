'use client'

import type { ReactNode } from 'react'

import { MunicipalityHeaderFilter } from '@/components/campaign/municipality/MunicipalityHeaderFilter'
import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { CampaignSortableHead } from '@/components/campaign/shared/CampaignSortableHead'
import type {
  MunicipalityFilterOption,
  MunicipalityFilterParam,
} from '@/utilities/municipalityListFilters'
import {
  buildMunicipalitySortHref,
  defaultMunicipalityListSortDir,
  municipalityListSortLabels,
  resolveMunicipalityListSort,
  type MunicipalityListSortKey,
  type MunicipalityListState,
} from '@/utilities/municipalityListUrl'

type MunicipalitySortableHeadProps = {
  state: MunicipalityListState
  sortKey: MunicipalityListSortKey
  children?: ReactNode
  tooltip?: ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
  filterParam?: MunicipalityFilterParam
  /** Pairs, or bare catalog slugs labeled on the client (B16+ payload trim). */
  filterOptions?: MunicipalityFilterOption[] | readonly string[]
  showPriorityFilter?: boolean
}

export const MunicipalitySortableHead = ({
  state,
  sortKey,
  children,
  tooltip,
  className,
  align = 'left',
  filterParam,
  filterOptions,
  showPriorityFilter,
}: MunicipalitySortableHeadProps) => {
  const href = buildMunicipalitySortHref(state, sortKey)
  const { sort: activeSort, dir } = resolveMunicipalityListSort(state)
  const active = activeSort === sortKey
  const label = children ?? municipalityListSortLabels[sortKey]
  const nextDir = active
    ? dir === 'asc'
      ? 'desc'
      : 'asc'
    : defaultMunicipalityListSortDir(sortKey)
  return (
    <CampaignSortableHead
      active={active}
      align={align}
      className={className}
      dir={dir}
      href={href}
      nextDir={nextDir}
      sortLabel={municipalityListSortLabels[sortKey]}
      filter={
        filterParam ? (
          <MunicipalityHeaderFilter
            state={state}
            filterParam={filterParam}
            options={filterOptions}
            showPriorityFilter={showPriorityFilter}
          />
        ) : null
      }
      wrapSortControl={
        tooltip
          ? (control) => (
              <CampaignHoverTooltip
                content={tooltip}
                align={align === 'right' ? 'end' : align === 'center' ? 'center' : 'start'}
              >
                {control}
              </CampaignHoverTooltip>
            )
          : undefined
      }
    >
      {label}
    </CampaignSortableHead>
  )
}
