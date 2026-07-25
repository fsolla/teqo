'use client'

import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { MunicipalityHeaderFilter } from '@/components/campaign/municipality/MunicipalityHeaderFilter'
import { MunicipalityHoverTooltip } from '@/components/campaign/municipality/MunicipalityHoverTooltip'
import { TableHead } from '@/components/ui/Table'
import { cn } from '@/lib/utils'
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
  const ariaSort = active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
  const nextDir = active
    ? dir === 'asc'
      ? 'desc'
      : 'asc'
    : defaultMunicipalityListSortDir(sortKey)
  const nextDirLabel = nextDir === 'asc' ? 'crescente' : 'decrescente'

  const sortControl = (
    <CampaignTransitionAnchor
      href={href}
      replace
      scroll={false}
      className={cn(
        'group inline-flex min-h-11 items-center gap-1 rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'hover:text-foreground',
        active ? 'font-medium' : 'font-normal',
        align === 'right' && !filterParam && 'w-full justify-end',
        align === 'center' && !filterParam && 'w-full justify-center',
      )}
      aria-label={
        active
          ? `Ordenar por ${municipalityListSortLabels[sortKey]}, inverter para ${nextDirLabel}`
          : `Ordenar por ${municipalityListSortLabels[sortKey]} (${nextDirLabel})`
      }
    >
      <span>{label}</span>
      {active ? (
        dir === 'asc' ? (
          <ChevronUpIcon className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
        )
      ) : (
        <ChevronsUpDownIcon
          className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      )}
    </CampaignTransitionAnchor>
  )

  const labeledSort = tooltip ? (
    <MunicipalityHoverTooltip
      content={tooltip}
      align={align === 'right' ? 'end' : align === 'center' ? 'center' : 'start'}
    >
      {sortControl}
    </MunicipalityHoverTooltip>
  ) : (
    sortControl
  )

  return (
    <TableHead
      aria-sort={ariaSort}
      className={cn(
        'text-muted-foreground',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {filterParam ? (
        <div
          className={cn(
            'flex items-center',
            align === 'right' && 'justify-end',
            align === 'center' && 'justify-center',
          )}
        >
          {labeledSort}
          <MunicipalityHeaderFilter
            state={state}
            filterParam={filterParam}
            options={filterOptions}
            showPriorityFilter={showPriorityFilter}
          />
        </div>
      ) : (
        labeledSort
      )}
    </TableHead>
  )
}
