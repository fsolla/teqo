import { redirect } from 'next/navigation'
import React from 'react'

import { CampaignBottomNav } from '@/components/campaign/shell/CampaignBottomNav'
import { CampaignSidebar } from '@/components/campaign/shell/CampaignSidebar'
import { InstallPwaToast } from '@/components/campaign/shell/InstallPwaToast'
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
    // print: unlock the h-svh/overflow-hidden shells and drop the app chrome,
    // otherwise only the first page of the municipality dossier prints (E16).
    <SidebarProvider className="h-svh min-h-0 overflow-hidden print:h-auto print:overflow-visible">
      <CampaignSidebar user={campaignUserShellView(user)} />
      <SidebarInset className="h-svh min-h-0 overflow-hidden print:h-auto print:overflow-visible">
        <header className="flex min-h-14 shrink-0 items-center gap-3 bg-primary px-4 text-primary-foreground md:hidden print:hidden">
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
