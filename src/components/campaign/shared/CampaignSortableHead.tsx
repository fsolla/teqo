'use client'

import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from 'lucide-react'
import type { PointerEvent, ReactElement, ReactNode, Ref } from 'react'

import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { TableHead } from '@/components/ui/Table'
import { cn } from '@/lib/utils'

type CampaignSortableHeadProps = {
  active: boolean
  align?: 'left' | 'center' | 'right'
  children: ReactNode
  className?: string
  dir: 'asc' | 'desc'
  filter?: ReactNode
  href: string
  nextDir: 'asc' | 'desc'
  sortLabel: string
  wrapSortControl?: (
    control: ReactElement<{
      onPointerUp?: (event: PointerEvent) => void
      ref?: Ref<HTMLElement>
    }>,
  ) => ReactNode
}

export const CampaignSortableHead = ({
  active,
  align = 'left',
  children,
  className,
  dir,
  filter,
  href,
  nextDir,
  sortLabel,
  wrapSortControl,
}: CampaignSortableHeadProps) => {
  const sortControl = (
    <CampaignTransitionAnchor
      href={href}
      replace
      scroll={false}
      className={cn(
        'group inline-flex min-h-11 items-center gap-1 rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'hover:text-foreground',
        active ? 'font-medium' : 'font-normal',
        align === 'right' && !filter && 'w-full justify-end',
        align === 'center' && !filter && 'w-full justify-center',
      )}
      aria-label={
        active
          ? `Ordenar por ${sortLabel}, inverter para ${nextDir === 'asc' ? 'crescente' : 'decrescente'}`
          : `Ordenar por ${sortLabel} (${nextDir === 'asc' ? 'crescente' : 'decrescente'})`
      }
    >
      <span>{children}</span>
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
  const labeledSort = wrapSortControl ? wrapSortControl(sortControl) : sortControl

  return (
    <TableHead
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'text-muted-foreground',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {filter ? (
        <div
          className={cn(
            'flex items-center',
            align === 'right' && 'justify-end',
            align === 'center' && 'justify-center',
          )}
        >
          {labeledSort}
          {filter}
        </div>
      ) : (
        labeledSort
      )}
    </TableHead>
  )
}
