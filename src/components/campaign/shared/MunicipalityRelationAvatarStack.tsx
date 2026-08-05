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
}: {
  entries: MunicipalityRelationEntry[]
  emptyState: ReactNode
  maxVisible?: number
}) => {
  if (entries.length === 0) return emptyState

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {entries.slice(0, maxVisible).map((entry) => (
          <Avatar key={entry.id} className="size-8 border-2 border-background">
            <AvatarFallback>
              {campaignUserInitials(entry.initialsLabel ?? entry.label)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="sr-only">{entries.map((entry) => entry.label).join(', ')}</span>
    </div>
  )
}
