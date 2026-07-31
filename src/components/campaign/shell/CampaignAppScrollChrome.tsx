'use client'

import type { ReactNode } from 'react'

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
  const quickActionsPeek = useQuickActionsChromeActive(role)

  return (
    <>
      <CampaignContentScroll quickActionsPeek={quickActionsPeek}>{children}</CampaignContentScroll>
      <CampaignQuickActionsHost role={role} />
    </>
  )
}
