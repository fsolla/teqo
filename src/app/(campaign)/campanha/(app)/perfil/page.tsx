import config from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPasskeysCard } from '@/components/campaign/auth/CampaignPasskeysCard'
import { CampaignProfileSettings } from '@/components/campaign/auth/CampaignProfileSettings'
import { deviceLabelFromUserAgent } from '@/lib/deviceLabel'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { campaignUserShellView } from '@/utilities/campaignUserProfile'
import { loadCampaignPasskeys } from '@/utilities/campaignWebAuthnCeremony'
import { resolveCampaignWebAuthnRelyingParty } from '@/utilities/campaignWebAuthnConfig'

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

  const payload = await getPayload({ config })
  const [passkeys, relyingParty, requestHeaders] = await Promise.all([
    loadCampaignPasskeys(payload, user.id),
    resolveCampaignWebAuthnRelyingParty(),
    headers(),
  ])

  return (
    <CampaignProfileSettings
      user={{
        ...campaignUserShellView(user),
        email: user.email,
        username: user.username,
      }}
      passwordResetBanner={params.passwordReset === '1'}
      // Passed as a slot so the settings component stays a client island for
      // its forms while this card owns its own state next to it.
      biometricsSlot={
        <CampaignPasskeysCard
          passkeys={passkeys}
          biometricsConfigured={relyingParty !== null}
          suggestedDeviceLabel={deviceLabelFromUserAgent(requestHeaders.get('user-agent'))}
        />
      }
    />
  )
}
