'use client'

import type { ReactNode } from 'react'

import {
  CampaignGlobalSearchBody,
  CampaignGlobalSearchProvider,
} from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'
import { CampaignHomeSearch } from '@/components/campaign/dashboard/CampaignHomeSearch'
import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import {
  HomeSearchResultsProvider,
  useHomeSearchResultsState,
} from '@/components/campaign/dashboard/HomeSearchResultsContext'

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

const CampaignHomeStaffChromeInner = ({
  actions,
  searchResults,
  summarySlot,
}: {
  actions: ReactNode
  /** Result groups plug in here from B48+. Defaults to global search when omitted. */
  searchResults?: ReactNode
  summarySlot?: ReactNode
}) => {
  const { uiFocused: focused } = useHomeSearch()

  return (
    <div className="h-full min-h-0 w-full" data-home-focused={focused || undefined}>
      <CampaignHomeLayout
        actions={actions}
        focused={focused}
        searchSlot={
          searchResults ? (
            <CampaignHomeStaffSearchSlot searchResults={searchResults} />
          ) : (
            <CampaignGlobalSearchBody />
          )
        }
        summarySlot={summarySlot}
      />
    </div>
  )
}

export const CampaignHomeStaffChrome = ({
  actions,
  searchResults,
  summarySlot,
}: {
  actions: ReactNode
  searchResults?: ReactNode
  summarySlot?: ReactNode
}) => (
  <CampaignGlobalSearchProvider>
    <CampaignHomeStaffChromeInner
      actions={actions}
      searchResults={searchResults}
      summarySlot={summarySlot}
    />
  </CampaignGlobalSearchProvider>
)
