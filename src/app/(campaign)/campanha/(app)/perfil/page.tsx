import config from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPasskeysCard } from '@/components/campaign/auth/CampaignPasskeysCard'
import { CampaignProfileSettings } from '@/components/campaign/auth/CampaignProfileSettings'
import { CampaignPushNotificationsCard } from '@/components/campaign/auth/CampaignPushNotificationsCard'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { deviceLabelFromUserAgent } from '@/lib/deviceLabel'
import { getCampaignUserWithAvatar } from '@/utilities/campaignAuth'
import { getCampaignPushConsent } from '@/utilities/campaignConsent'
import { campaignUserShellView } from '@/utilities/campaignUserProfile'
import { getCampaignVapidPublicKey } from '@/utilities/notification/sendCampaignPush'
import { loadCampaignPasskeys } from '@/utilities/webauthn/campaignWebAuthnCeremony'
import { resolveCampaignWebAuthnRelyingParty } from '@/utilities/webauthn/campaignWebAuthnConfig'

export const metadata = campaignPageMetadataFromCatalog('perfil')

type CampaignProfilePageProps = {
  searchParams: Promise<{ passwordReset?: string }>
}

export default async function CampaignProfilePage({ searchParams }: CampaignProfilePageProps) {
  const [user, params] = await Promise.all([getCampaignUserWithAvatar(), searchParams])
  if (!user) redirect('/campanha/login')

  const payload = await getPayload({ config })
  const [passkeys, relyingParty, requestHeaders, pushConsent] = await Promise.all([
    loadCampaignPasskeys(payload, user.id),
    resolveCampaignWebAuthnRelyingParty(),
    headers(),
    getCampaignPushConsent(payload),
  ])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
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
      <CampaignPushNotificationsCard
        pushConsentConfigured={pushConsent !== null}
        vapidPublicKey={getCampaignVapidPublicKey()}
      />
    </div>
  )
}
