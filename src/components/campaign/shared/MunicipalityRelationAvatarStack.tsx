'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import {
  RELATION_AVATAR_MIN_OVERLAP_PX,
  relationAvatarOverlapPx,
} from '@/lib/relationAvatarOverlap'
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
   * B196/B200 — dense card mode: every entry gets its own avatar (no cap), in
   * ONE row that never wraps, anchored LEFT as a pile. The overlap between
   * consecutive avatars is measured against the group's real width (see
   * `relationAvatarOverlapPx`): at least 8px so even two avatars read as a
   * deliberate stack, and deeper as the count grows so the pile always fits —
   * no avatar is capped, hidden behind a "…", clipped at the box edge, or
   * poking into the neighbouring group (the sr-only names list everyone).
   */
  overlapRow?: boolean
}) => {
  const rowRef = useRef<HTMLDivElement>(null)
  const [overlap, setOverlap] = useState(RELATION_AVATAR_MIN_OVERLAP_PX)

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const observer = new ResizeObserver(() => {
      setOverlap(relationAvatarOverlapPx(entries.length, row.clientWidth))
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [entries.length, overlapRow])

  if (entries.length === 0) return emptyState

  const visible = overlapRow ? entries : entries.slice(0, maxVisible)

  if (overlapRow) {
    return (
      // `overflow-hidden` stays as a last-resort guard: with the measured
      // overlap the pile fits the group exactly, so it never clips or
      // slivers into the neighbouring group.
      <div
        ref={rowRef}
        className="flex w-full min-w-0 items-center overflow-hidden"
        data-view="relation-avatars"
      >
        {visible.map((entry, index) => (
          <Avatar
            key={entry.id}
            className="size-7 shrink-0 border-0"
            style={index === 0 ? undefined : { marginLeft: -overlap }}
          >
            {/* The full names ride in the sr-only span below (or the trigger's
                aria-label); initials alone would be announced twice. */}
            <AvatarFallback aria-hidden="true">
              {campaignUserInitials(entry.initialsLabel ?? entry.label)}
            </AvatarFallback>
          </Avatar>
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
