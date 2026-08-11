import type { ReactNode } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
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
  overlapRow = false,
}: {
  entries: MunicipalityRelationEntry[]
  emptyState: ReactNode
  maxVisible?: number
  /**
   * B196 — dense card mode: every entry gets its own avatar (no cap), in ONE
   * row that never wraps. Each avatar sits centered in a flex-1 cell, so few
   * entries render apart (cell wider than the avatar) and many overlap
   * progressively — the overlap is proportional to the count, no avatar is
   * capped or hidden behind a "…", and the row always fills the group width.
   */
  overlapRow?: boolean
}) => {
  if (entries.length === 0) return emptyState

  const visible = overlapRow ? entries : entries.slice(0, maxVisible)

  if (overlapRow) {
    return (
      // `overflow-hidden` clips the pile at the group's box on extreme counts
      // (the sr-only names below still list everyone) — no slivers into the
      // neighbouring group.
      <div
        className="flex w-full min-w-0 items-center overflow-hidden"
        data-view="relation-avatars"
      >
        {visible.map((entry) => (
          <div key={entry.id} className="flex min-w-0 flex-1 justify-center">
            <Avatar className="size-7 shrink-0 border-0">
              {/* The full names ride in the sr-only span below (or the trigger's
                  aria-label); initials alone would be announced twice. */}
              <AvatarFallback aria-hidden="true">
                {campaignUserInitials(entry.initialsLabel ?? entry.label)}
              </AvatarFallback>
            </Avatar>
          </div>
        ))}
        <span className="sr-only">{entries.map((entry) => entry.label).join(', ')}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visible.map((entry) => (
          <Avatar key={entry.id} className="size-8 border-2 border-background">
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
