'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { MunicipalityPriorityIndicator } from '@/components/campaign/municipality/MunicipalityPriorityIndicator'
import { HOME_SEARCH_HIT_ROW_WRAPPER_CLASS } from '@/lib/homeSearchUi'
import { cn } from '@/lib/utils'

const HOME_SEARCH_PRIORITY_ICON_SLOT_CLASS = 'flex w-4 shrink-0 justify-center'

export const HomeSearchHitRow = ({
  href,
  primary,
  secondary,
  trailing,
  trailingAction,
  showPriority = false,
}: {
  href: string
  primary: string
  secondary?: string
  trailing?: ReactNode
  trailingAction?: ReactNode
  showPriority?: boolean
}) => (
  <div
    className={cn(
      HOME_SEARCH_HIT_ROW_WRAPPER_CLASS,
      trailingAction ? 'flex items-center gap-0' : undefined,
    )}
  >
    <Link
      href={href}
      onMouseDown={(event) => {
        // Combobox/list precedent: RelationChipCell — keep input focused until navigation (B66).
        event.preventDefault()
      }}
      className={cn(
        'flex min-h-11 items-center gap-3 py-2.5 text-left text-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        trailingAction ? 'min-w-0 flex-1' : 'w-full',
      )}
    >
      <span className={HOME_SEARCH_PRIORITY_ICON_SLOT_CLASS} aria-hidden={!showPriority}>
        {showPriority ? <MunicipalityPriorityIndicator /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{primary}</span>
        {secondary ? (
          <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </Link>
    {trailingAction ? <span className="shrink-0">{trailingAction}</span> : null}
  </div>
)
