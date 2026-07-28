import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { CAMPAIGN_BIOMETRIC_LOGIN_ERROR_MESSAGE } from '@/lib/campaignAuthCopy'
import type { CampaignWebAuthnLoginResponse } from '@/lib/campaignWebAuthn'
import { campaignWebAuthnLoginSchema } from '@/lib/schemas/campaignWebAuthn'
import { setCampaignAuthCookie } from '@/utilities/campaignAuth'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import {
  campaignWebAuthnSafeMessages,
  completeCampaignAuthentication,
} from '@/utilities/campaignWebAuthnCeremony'
import { CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE } from '@/utilities/campaignWebAuthnChallenge'
import {
  CAMPAIGN_WEBAUTHN_ACCOUNT_LOCKED_MESSAGE,
  CAMPAIGN_WEBAUTHN_ACCOUNT_UNAVAILABLE_MESSAGE,
} from '@/utilities/campaignWebAuthnSession'

export const dynamic = 'force-dynamic'

/**
 * Password-less sign-in. Anonymous on the way in and holding a `campaign-token`
 * on the way out, with the same 14-day TTL the "Lembrar de mim" checkbox grants
 * — enrolling the passkey on this device *is* the trust opt-in.
 */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: campaignWebAuthnLoginSchema,
    safeMessages: [
      ...campaignWebAuthnSafeMessages,
      CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE,
      CAMPAIGN_WEBAUTHN_ACCOUNT_UNAVAILABLE_MESSAGE,
      CAMPAIGN_WEBAUTHN_ACCOUNT_LOCKED_MESSAGE,
    ],
    genericMessage: CAMPAIGN_BIOMETRIC_LOGIN_ERROR_MESSAGE,
  },
  async ({ credential }): Promise<NextResponse<CampaignWebAuthnLoginResponse>> => {
    const payload = await getPayload({ config })
    const { token, tokenExpiration } = await completeCampaignAuthentication(payload, credential)
    await setCampaignAuthCookie(token, payload, tokenExpiration)

    return NextResponse.json({ status: 'success', redirectTo: '/campanha' })
  },
)
