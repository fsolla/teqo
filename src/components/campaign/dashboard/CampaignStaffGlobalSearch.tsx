'use client'

import { CampaignHomeSearch } from '@/components/campaign/dashboard/CampaignHomeSearch'
import { HomeSearchActivityGroup } from '@/components/campaign/dashboard/HomeSearchActivityGroup'
import { HomeSearchAdvisorGroup } from '@/components/campaign/dashboard/HomeSearchAdvisorGroup'
import { HomeSearchDemandGroup } from '@/components/campaign/dashboard/HomeSearchDemandGroup'
import { HomeSearchLeadershipGroup } from '@/components/campaign/dashboard/HomeSearchLeadershipGroup'
import { HomeSearchMunicipalityGroup } from '@/components/campaign/dashboard/HomeSearchMunicipalityGroup'
import {
  HomeSearchResultsProvider,
  useHomeSearchResultsState,
} from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { HomeSearchResultsLayout } from '@/components/campaign/dashboard/HomeSearchResultsLayout'
import { HomeSearchResultsShell } from '@/components/campaign/dashboard/HomeSearchResultsShell'
import { HomeSearchStateDeputyGroup } from '@/components/campaign/dashboard/HomeSearchStateDeputyGroup'

const CampaignStaffGlobalSearchResults = () => {
  const searchResultsState = useHomeSearchResultsState()

  return (
    <CampaignHomeSearch resultsBusy={searchResultsState.isFetching}>
      <HomeSearchResultsProvider value={searchResultsState}>
        <HomeSearchResultsShell>
          <HomeSearchResultsLayout>
            <HomeSearchMunicipalityGroup />
            <HomeSearchLeadershipGroup />
            <HomeSearchAdvisorGroup />
            <HomeSearchActivityGroup />
            <HomeSearchStateDeputyGroup />
            <HomeSearchDemandGroup />
          </HomeSearchResultsLayout>
        </HomeSearchResultsShell>
      </HomeSearchResultsProvider>
    </CampaignHomeSearch>
  )
}

/** Result groups + input — requires an ancestor `HomeSearchProvider`. */
export const CampaignStaffGlobalSearchBody = CampaignStaffGlobalSearchResults
