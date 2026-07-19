import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { CampaignAuthPageShell } from '@/components/campaign/CampaignAuthPageShell'
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
    <CampaignAuthPageShell>
      <LoginForm />
    </CampaignAuthPageShell>
  )
}
