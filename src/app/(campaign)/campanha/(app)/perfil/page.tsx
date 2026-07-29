import config from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { CampaignPasskeysCard } from '@/components/campaign/auth/CampaignPasskeysCard'
import { CampaignProfileSettings } from '@/components/campaign/auth/CampaignProfileSettings'
import { deviceLabelFromUserAgent } from '@/lib/deviceLabel'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { campaignUserShellView } from '@/utilities/campaignUserProfile'
import { loadCampaignPasskeys } from '@/utilities/webauthn/campaignWebAuthnCeremony'
import { resolveCampaignWebAuthnRelyingParty } from '@/utilities/webauthn/campaignWebAuthnConfig'

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
  const [user, params] = await Promise.all([requireCampaignPageActor(), searchParams])

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
