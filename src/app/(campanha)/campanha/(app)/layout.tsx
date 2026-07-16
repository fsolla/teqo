import { redirect } from 'next/navigation'
import React from 'react'

import { CampaignSidebar } from '@/components/campanha/campaign-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { getCampaignUser } from '@/utilities/campaignAuth'

export default async function CampaignAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCampaignUser()

  if (!user) {
    redirect('/campanha/login')
  }

  return (
    <SidebarProvider>
      <CampaignSidebar user={{ name: user.name, email: user.email }} />
      <SidebarInset>
        <header className="flex h-12 items-center border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
