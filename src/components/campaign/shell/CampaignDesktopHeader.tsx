'use client'

import { Fragment, type ReactNode } from 'react'

import { CampaignAIHeaderButton } from '@/components/campaign/shell/ai/CampaignAIHeaderButton'
import { useCampaignHeaderActions } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageChromeDisplay } from '@/components/campaign/shell/CampaignPageChromeDisplay'
import { SidebarTrigger } from '@/components/ui/Sidebar'
import { canUseCampaignAssistant, type CampaignRole } from '@/lib/campaignRoles'

export const CampaignDesktopHeader = ({
  notificationBell,
  role,
}: {
  notificationBell?: ReactNode
  role: CampaignRole
}) => {
  const headerActions = useCampaignHeaderActions()

  return (
    <header className="hidden min-h-11 shrink-0 items-center gap-3 border-b border-border px-4 md:flex print:hidden">
      <SidebarTrigger />
      <CampaignPageChromeDisplay layout="desktop" className="flex-1" />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {Object.entries(headerActions).map(([id, node]) => (
          <Fragment key={id}>{node}</Fragment>
        ))}
        {notificationBell ?? null}
        {canUseCampaignAssistant(role) ? <CampaignAIHeaderButton /> : null}
      </div>
    </header>
  )
}
