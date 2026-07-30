'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { MunicipalityPriorityIndicator } from '@/components/campaign/municipality/MunicipalityPriorityIndicator'
import { cn } from '@/lib/utils'

const PRIORITY_ICON_SLOT_CLASS = 'flex w-4 shrink-0 justify-center'

export const HomeSearchHitRow = ({
  href,
  primary,
  secondary,
  trailing,
  showPriority,
}: {
  href: string
  primary: string
  secondary?: string
  trailing: ReactNode
  showPriority: boolean
}) => (
  <Link
    href={href}
    className={cn(
      'flex min-h-11 items-center gap-3 py-2.5 text-foreground',
      'rounded-md outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
    )}
  >
    <span className={PRIORITY_ICON_SLOT_CLASS} aria-hidden={!showPriority}>
      {showPriority ? <MunicipalityPriorityIndicator /> : null}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">{primary}</span>
      {secondary ? (
        <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
      ) : null}
    </span>
    <span className="shrink-0">{trailing}</span>
  </Link>
)
