import type { ReactNode } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { campaignUserInitials } from '@/utilities/campaignUserProfile'

export type MunicipalityRelationEntry = {
  id: number
  label: string
  searchText?: string
  initialsLabel?: string
  optionSuffix?: string
  href?: string
}

export const MunicipalityRelationAvatarStack = ({
  entries,
  emptyState,
  maxVisible = 3,
  wrap = false,
}: {
  entries: MunicipalityRelationEntry[]
  emptyState: ReactNode
  maxVisible?: number
  /**
   * B193 — dense card mode: every entry gets its own avatar (no cap) and the
   * row wraps to the available width instead of overlapping in a fixed stack.
   */
  wrap?: boolean
}) => {
  if (entries.length === 0) return emptyState

  const visible = wrap ? entries : entries.slice(0, maxVisible)

  return (
    <div className={cn('flex items-center gap-2', wrap && 'w-full min-w-0 flex-wrap gap-1.5')}>
      <div className={cn('flex', wrap ? 'flex-wrap gap-1.5' : '-space-x-2')}>
        {visible.map((entry) => (
          <Avatar
            key={entry.id}
            className={cn('size-8 border-2 border-background', wrap && 'size-7 border-0')}
          >
            {/* The full names ride in the sr-only span below (or the trigger's
                aria-label); initials alone would be announced twice. */}
            <AvatarFallback aria-hidden="true">
              {campaignUserInitials(entry.initialsLabel ?? entry.label)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="sr-only">{entries.map((entry) => entry.label).join(', ')}</span>
    </div>
  )
}
