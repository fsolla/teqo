'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { CampaignGlobalSearchProvider } from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import {
  CampaignContentScroll,
  CampaignQuickActionsHost,
  useQuickActionsChromeActive,
} from '@/components/campaign/shell/CampaignQuickActionsHost'
import { CampaignQuickActionsSnapProvider } from '@/components/campaign/shell/CampaignQuickActionsSnapContext'
import { isCampaignHomePath } from '@/lib/campaignQuickActionMount'
import type { CampaignRole } from '@/lib/campaignRoles'

export const CampaignAppScrollChrome = ({
  role,
  children,
}: {
  role: CampaignRole
  children: ReactNode
}) => {
  const pathname = usePathname()
  const quickActionsActive = useQuickActionsChromeActive(role)
  const compactHomeBottomPadding = isCampaignHomePath(pathname)

  if (!quickActionsActive) {
    return (
      <CampaignContentScroll
        quickActionsPeek={false}
        compactHomeBottomPadding={compactHomeBottomPadding}
      >
        {children}
      </CampaignContentScroll>
    )
  }

  return (
    <CampaignQuickActionsSnapProvider>
      <CampaignGlobalSearchProvider>
        <CampaignContentScroll quickActionsPeek>{children}</CampaignContentScroll>
        <CampaignQuickActionsHost role={role} />
      </CampaignGlobalSearchProvider>
    </CampaignQuickActionsSnapProvider>
  )
}
