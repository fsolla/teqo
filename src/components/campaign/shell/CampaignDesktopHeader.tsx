'use client'

import type { ReactNode } from 'react'

import { CampaignAIHeaderButton } from '@/components/campaign/shell/ai/CampaignAIHeaderButton'
import { useCampaignHeaderActions } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageChromeDisplay } from '@/components/campaign/shell/CampaignPageChromeDisplay'
import { SidebarTrigger } from '@/components/ui/Sidebar'

export const CampaignDesktopHeader = ({ notificationBell }: { notificationBell?: ReactNode }) => {
  const headerActions = useCampaignHeaderActions()

  return (
    <header className="hidden min-h-11 shrink-0 items-center gap-3 border-b border-border px-4 md:flex print:hidden">
      <SidebarTrigger />
      <CampaignPageChromeDisplay layout="desktop" className="flex-1" />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {Object.values(headerActions)}
        {notificationBell ?? null}
        <CampaignAIHeaderButton />
      </div>
    </header>
  )
}
