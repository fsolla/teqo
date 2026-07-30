'use client'

import type { ReactNode } from 'react'

import {
  HomeSearchHitBudgetProvider,
  useHomeSearchViewportTier,
} from '@/components/campaign/dashboard/HomeSearchHitBudgetContext'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import {
  allocateHitBudget,
  buildHomeSearchGroupHitCounts,
  homeSearchHitBudgetForTier,
  type HomeSearchGroupHitCounts,
} from '@/lib/homeSearchHitBudget'

const EMPTY_GROUP_COUNTS: HomeSearchGroupHitCounts = {
  municipalities: 0,
  leaderships: 0,
  advisors: 0,
  activities: 0,
  stateDeputies: 0,
  demands: 0,
}

export const HomeSearchResultsLayout = ({ children }: { children: ReactNode }) => {
  const { results } = useHomeSearchResults()
  const viewportTier = useHomeSearchViewportTier()
  const budget = homeSearchHitBudgetForTier(viewportTier)

  const limits =
    results.status === 'success'
      ? allocateHitBudget(buildHomeSearchGroupHitCounts(results.data), budget)
      : allocateHitBudget(EMPTY_GROUP_COUNTS, budget)

  return (
    <HomeSearchHitBudgetProvider limits={limits}>
      <div
        data-slot="home-search-results-layout"
        className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3"
      >
        {children}
      </div>
    </HomeSearchHitBudgetProvider>
  )
}
