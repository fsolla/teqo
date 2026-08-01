'use client'

import type { ReactNode } from 'react'

import { CampaignGlobalSearchProvider } from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import {
  CampaignContentScroll,
  CampaignQuickActionsHost,
  useQuickActionsChromeActive,
} from '@/components/campaign/shell/CampaignQuickActionsHost'
import {
  CampaignQuickActionsScrollCollapse,
  CampaignQuickActionsSnapProvider,
} from '@/components/campaign/shell/CampaignQuickActionsSnapContext'
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
    return <CampaignContentScroll quickActionsPeek={false}>{children}</CampaignContentScroll>
  }

  return (
    <CampaignQuickActionsSnapProvider>
      <CampaignGlobalSearchProvider>
        <CampaignQuickActionsScrollCollapse />
        <CampaignContentScroll quickActionsPeek>{children}</CampaignContentScroll>
        <CampaignQuickActionsHost role={role} />
      </CampaignGlobalSearchProvider>
    </CampaignQuickActionsSnapProvider>
  )
}
