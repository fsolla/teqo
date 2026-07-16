import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { logoutCampaign } from '@/app/(campanha)/campanha/actions/auth'
import { Button } from '@/components/ui/button'
import { getCampaignUser } from '@/utilities/campaignAuth'

export default async function CampaignAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCampaignUser()

  if (!user) {
    redirect('/campanha/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <nav className="flex items-center gap-4">
          <Link href="/campanha" className="font-bold">
            Campanha
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <form action={logoutCampaign}>
            <Button type="submit" variant="outline" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  )
}
