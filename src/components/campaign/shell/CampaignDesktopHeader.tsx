'use client'

import { CampaignNotificationBellSlot } from '@/components/campaign/shell/CampaignNotificationBellSlot'
import { CampaignPageChromeDisplay } from '@/components/campaign/shell/CampaignPageChromeDisplay'
import { SidebarTrigger } from '@/components/ui/Sidebar'
import type { CampaignUser } from '@/payload-types'

export const CampaignDesktopHeader = ({ user }: { user: CampaignUser }) => (
  <header className="hidden min-h-11 shrink-0 items-center gap-3 border-b border-border px-4 md:flex print:hidden">
    <SidebarTrigger />
    <CampaignPageChromeDisplay layout="desktop" className="flex-1" />
    <div className="ml-auto shrink-0">
      <CampaignNotificationBellSlot user={user} />
    </div>
  </header>
)
