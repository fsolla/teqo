import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { CampaignAuthPageShell } from '@/components/campaign/auth/CampaignAuthPageShell'
import { hasCampaignSession } from '@/utilities/campaignAuth'
import { resolveCampaignWebAuthnRelyingParty } from '@/utilities/webauthn/campaignWebAuthnConfig'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Entrar | Campanha',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function CampaignLoginPage() {
  const hasSession = await hasCampaignSession()

  if (hasSession) {
    redirect('/campanha')
  }

  // Half of the gate: this origin can host the ceremony at all. The other half
  // (does this device have a fingerprint reader) only the browser knows.
  const relyingParty = await resolveCampaignWebAuthnRelyingParty()

  return (
    <CampaignAuthPageShell>
      <LoginForm biometricsConfigured={relyingParty !== null} />
    </CampaignAuthPageShell>
  )
}
