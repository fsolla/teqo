import { redirect } from 'next/navigation'
import React from 'react'

import { CampaignBottomNav } from '@/components/campaign/CampaignBottomNav'
import { CampaignSidebar } from '@/components/campaign/CampaignSidebar'
import { InstallPwaToast } from '@/components/campaign/InstallPwaToast'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/Sidebar'
import { Toaster } from '@/components/ui/Toaster'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { campaignUserShellView } from '@/utilities/campaignUserProfile'

export default async function CampaignAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCampaignUser()

  if (!user) {
    redirect('/campanha/login')
  }

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <CampaignSidebar user={campaignUserShellView(user)} />
      <SidebarInset className="h-svh min-h-0 overflow-hidden">
        <header className="flex min-h-14 shrink-0 items-center gap-3 bg-primary px-4 text-primary-foreground md:hidden">
          <SidebarTrigger
            label="Abrir ou fechar menu da campanha"
            className="text-primary-foreground"
          />
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">Jorge Solla</span>
            <span className="block truncate text-xs text-primary-foreground/80">
              Campanha · Bahia
            </span>
          </div>
        </header>
        <div
          data-slot="campaign-content-scroll"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-24 md:p-6 md:pb-6"
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
