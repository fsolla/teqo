import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { CampaignProfileSettings } from '@/components/campaign/auth/CampaignProfileSettings'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { campaignUserShellView } from '@/utilities/campaignUserProfile'

export const metadata: Metadata = {
  title: 'Meu perfil | Campanha',
  robots: {
    index: false,
    follow: false,
  },
}

type CampaignProfilePageProps = {
  searchParams: Promise<{ passwordReset?: string }>
}

export default async function CampaignProfilePage({ searchParams }: CampaignProfilePageProps) {
  const [user, params] = await Promise.all([getCampaignUser(), searchParams])

  if (!user) {
    redirect('/campanha/login')
  }

  return (
    <CampaignProfileSettings
      user={{
        ...campaignUserShellView(user),
        email: user.email,
        username: user.username,
      }}
      passwordResetBanner={params.passwordReset === '1'}
    />
  )
}
