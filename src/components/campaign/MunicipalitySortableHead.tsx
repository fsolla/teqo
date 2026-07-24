'use client'

import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { CampaignTransitionAnchor } from '@/components/campaign/CampaignListPending'
import { MunicipalityHoverTooltip } from '@/components/campaign/MunicipalityHoverTooltip'
import { TableHead } from '@/components/ui/Table'
import { cn } from '@/lib/utils'
import {
  buildMunicipalitySortHref,
  defaultMunicipalityListSortDir,
  municipalityListSortLabels,
  resolveMunicipalityListSort,
  type MunicipalityListSortKey,
  type MunicipalityListState,
} from '@/utilities/municipalityUi'

type MunicipalitySortableHeadProps = {
  state: MunicipalityListState
  sortKey: MunicipalityListSortKey
  children?: ReactNode
  tooltip?: ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
}

export const MunicipalitySortableHead = ({
  state,
  sortKey,
  children,
  tooltip,
  className,
  align = 'left',
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
        'group inline-flex min-h-11 items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'font-medium text-foreground hover:text-primary'
          : 'font-normal text-muted-foreground hover:text-foreground',
        align === 'right' && 'w-full justify-end',
        align === 'center' && 'w-full justify-center',
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

  return (
    <TableHead
      aria-sort={ariaSort}
      className={cn(
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {tooltip ? (
        <MunicipalityHoverTooltip
          content={tooltip}
          align={align === 'right' ? 'end' : align === 'center' ? 'center' : 'start'}
        >
          {sortControl}
        </MunicipalityHoverTooltip>
      ) : (
        sortControl
      )}
    </TableHead>
  )
}
