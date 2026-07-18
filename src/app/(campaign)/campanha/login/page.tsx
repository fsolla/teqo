import { Megaphone } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getCampaignUser } from '@/utilities/campaignAuth'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Entrar | Campanha',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function CampaignLoginPage() {
  const user = await getCampaignUser()

  if (user) {
    redirect('/campanha')
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-semibold">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Megaphone className="size-4" />
          </div>
          Campanha
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
