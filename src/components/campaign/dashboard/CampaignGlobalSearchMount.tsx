'use client'

import type { ReactNode } from 'react'

import { CampaignStaffGlobalSearchBody } from '@/components/campaign/dashboard/CampaignStaffGlobalSearch'
import { HomeSearchProvider } from '@/components/campaign/dashboard/HomeSearchContext'
import { useHomeSearchQuery } from '@/components/campaign/dashboard/useHomeSearchQuery'

/** Owns debounce + focus state for any global search surface (Início, drawer B91). */
export const CampaignGlobalSearchProvider = ({ children }: { children: ReactNode }) => {
  const searchState = useHomeSearchQuery()
  return <HomeSearchProvider value={searchState}>{children}</HomeSearchProvider>
}

/** Input + result groups — requires `CampaignGlobalSearchProvider` unless using the mount. */
export const CampaignGlobalSearchBody = CampaignStaffGlobalSearchBody

/** Provider + default global search body (drawer, smoke tests). */
export const CampaignGlobalSearchMount = () => (
  <CampaignGlobalSearchProvider>
    <CampaignGlobalSearchBody />
  </CampaignGlobalSearchProvider>
)
