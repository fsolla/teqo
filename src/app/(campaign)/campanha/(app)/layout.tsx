import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import React from 'react'

import { CampaignBottomNav } from '@/components/campaign/shell/CampaignBottomNav'
import { CampaignSidebar } from '@/components/campaign/shell/CampaignSidebar'
import { CampaignSidebarViewportDefault } from '@/components/campaign/shell/CampaignSidebarViewportDefault'
import { InstallPwaToast } from '@/components/campaign/shell/InstallPwaToast'
import {
  SIDEBAR_COOKIE_NAME,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/Sidebar'
import { Toaster } from '@/components/ui/Toaster'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { campaignUserShellView } from '@/utilities/campaignUserProfile'

export default async function CampaignAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCampaignUser()

  if (!user) {
    redirect('/campanha/login')
  }

  const cookieStore = await cookies()
  const sidebarStateCookie = cookieStore.get(SIDEBAR_COOKIE_NAME)
  const hasSidebarCookie = sidebarStateCookie !== undefined
  const defaultOpen = sidebarStateCookie ? sidebarStateCookie.value === 'true' : true

  return (
    // print: unlock the h-svh/overflow-hidden shells and drop the app chrome,
    // otherwise only the first page of the municipality dossier prints (E16).
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh min-h-0 overflow-hidden print:h-auto print:overflow-visible"
    >
      <CampaignSidebarViewportDefault hasSidebarCookie={hasSidebarCookie} />
      <CampaignSidebar user={campaignUserShellView(user)} />
      <SidebarInset className="h-svh min-h-0 overflow-hidden print:h-auto print:overflow-visible">
        <header className="flex min-h-14 shrink-0 items-center gap-3 bg-primary px-4 text-primary-foreground md:hidden print:hidden">
          <SidebarTrigger className="text-primary-foreground" />
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">Jorge Solla</span>
            <span className="block truncate text-xs text-primary-foreground/80">
              Campanha · Bahia
            </span>
          </div>
        </header>
        <header className="hidden min-h-11 shrink-0 items-center gap-2 border-b border-border px-4 md:flex print:hidden">
          <SidebarTrigger />
        </header>
        <div
          data-slot="campaign-content-scroll"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-24 md:p-6 md:pb-6 print:h-auto print:overflow-visible print:p-0"
        >
          {children}
        </div>
        <CampaignBottomNav role={user.role} />
        <Toaster position="top-center" />
        <InstallPwaToast />
      </SidebarInset>
    </SidebarProvider>
  )
}
