'use client'

import type { ReactNode } from 'react'

import { CampaignGlobalSearchProvider } from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import {
  CampaignContentScroll,
  CampaignQuickActionsHost,
  useQuickActionsChromeActive,
} from '@/components/campaign/shell/CampaignQuickActionsHost'
import type { AdvisorEditingScope } from '@/lib/campaignAdvisorProfile'
import type { CampaignRole } from '@/lib/campaignRoles'

export const CampaignAppScrollChrome = ({
  role,
  editingScope = 'tudo',
  children,
}: {
  role: CampaignRole
  /** C142 — advisors with `somente_leitura` see no FAB on staff surfaces. */
  editingScope?: AdvisorEditingScope
  children: ReactNode
}) => {
  const quickActionsActive = useQuickActionsChromeActive(role, editingScope)

  if (!quickActionsActive) {
    return <CampaignContentScroll>{children}</CampaignContentScroll>
  }

  return (
    <CampaignGlobalSearchProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <CampaignContentScroll>{children}</CampaignContentScroll>
        <CampaignQuickActionsHost role={role} editingScope={editingScope} />
      </div>
    </CampaignGlobalSearchProvider>
  )
}
