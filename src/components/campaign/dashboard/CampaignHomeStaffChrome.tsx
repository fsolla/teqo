'use client'

import type { ReactNode } from 'react'

import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'
import { CampaignHomeSearch } from '@/components/campaign/dashboard/CampaignHomeSearch'
import { HomeSearchProvider } from '@/components/campaign/dashboard/HomeSearchContext'
import { useHomeSearchQuery } from '@/components/campaign/dashboard/useHomeSearchQuery'
import { cn } from '@/lib/utils'

export const CampaignHomeStaffChrome = ({
  actions,
  searchResults,
}: {
  actions: ReactNode
  /** Result groups plug in here from B48+. */
  searchResults?: ReactNode
}) => {
  const searchState = useHomeSearchQuery()
  const focused = searchState.query.isActive

  return (
    <HomeSearchProvider value={searchState}>
      <div
        className={cn('flex min-h-full w-full flex-col', focused && 'md:min-h-0')}
        data-home-focused={focused || undefined}
      >
        <CampaignHomeLayout
          actions={actions}
          focused={focused}
          searchSlot={<CampaignHomeSearch>{searchResults}</CampaignHomeSearch>}
        />
      </div>
    </HomeSearchProvider>
  )
}
