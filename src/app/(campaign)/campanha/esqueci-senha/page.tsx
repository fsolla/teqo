import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ForgotPasswordForm } from '@/app/(campaign)/campanha/esqueci-senha/ForgotPasswordForm'
import { CampaignAuthPageShell } from '@/components/campaign/auth/CampaignAuthPageShell'
import { getCampaignUser } from '@/utilities/campaignAuth'

export const metadata: Metadata = {
  title: 'Esqueci a senha | Campanha',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function CampaignForgotPasswordPage() {
  const user = await getCampaignUser()

  if (user) {
    redirect('/campanha/perfil')
  }

  return (
    <CampaignAuthPageShell>
      <ForgotPasswordForm />
    </CampaignAuthPageShell>
  )
}
