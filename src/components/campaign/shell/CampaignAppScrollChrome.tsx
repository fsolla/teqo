'use client'

import type { ReactNode } from 'react'

import { CampaignGlobalSearchProvider } from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import {
  CampaignContentScroll,
  CampaignQuickActionsHost,
  useQuickActionsChromeActive,
} from '@/components/campaign/shell/CampaignQuickActionsHost'
import type { CampaignRole } from '@/lib/campaignRoles'

export const CampaignAppScrollChrome = ({
  role,
  children,
}: {
  role: CampaignRole
  children: ReactNode
}) => {
  const quickActionsActive = useQuickActionsChromeActive(role)

  if (!quickActionsActive) {
    return <CampaignContentScroll>{children}</CampaignContentScroll>
  }

  return (
    <CampaignGlobalSearchProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <CampaignContentScroll>{children}</CampaignContentScroll>
        <CampaignQuickActionsHost role={role} />
      </div>
    </CampaignGlobalSearchProvider>
  )
}
