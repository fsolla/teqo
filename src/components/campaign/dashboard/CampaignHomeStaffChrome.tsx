'use client'

import type { ReactNode } from 'react'

import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'
import { CampaignHomeSearch } from '@/components/campaign/dashboard/CampaignHomeSearch'
import { CampaignStaffGlobalSearchBody } from '@/components/campaign/dashboard/CampaignStaffGlobalSearch'
import { HomeSearchProvider } from '@/components/campaign/dashboard/HomeSearchContext'
import {
  HomeSearchResultsProvider,
  useHomeSearchResultsState,
} from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { useHomeSearchQuery } from '@/components/campaign/dashboard/useHomeSearchQuery'

const CampaignHomeStaffSearchSlot = ({ searchResults }: { searchResults: ReactNode }) => {
  const searchResultsState = useHomeSearchResultsState()

  return (
    <CampaignHomeSearch resultsBusy={searchResultsState.isFetching}>
      <HomeSearchResultsProvider value={searchResultsState}>
        {searchResults}
      </HomeSearchResultsProvider>
    </CampaignHomeSearch>
  )
}

export const CampaignHomeStaffChrome = ({
  actions,
  searchResults,
  summarySlot,
}: {
  actions: ReactNode
  /** Result groups plug in here from B48+. Defaults to global search when omitted. */
  searchResults?: ReactNode
  summarySlot?: ReactNode
}) => {
  const searchState = useHomeSearchQuery()
  const focused = searchState.uiFocused

  return (
    <HomeSearchProvider value={searchState}>
      <div className="h-full min-h-0 w-full" data-home-focused={focused || undefined}>
        <CampaignHomeLayout
          actions={actions}
          focused={focused}
          searchSlot={
            searchResults ? (
              <CampaignHomeStaffSearchSlot searchResults={searchResults} />
            ) : (
              <CampaignStaffGlobalSearchBody />
            )
          }
          summarySlot={summarySlot}
        />
      </div>
    </HomeSearchProvider>
  )
}
