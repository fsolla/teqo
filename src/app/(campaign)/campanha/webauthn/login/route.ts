import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import type { CampaignWebAuthnLoginResponse } from '@/lib/campaignWebAuthn'
import { campaignWebAuthnLoginSchema } from '@/lib/schemas/campaignWebAuthn'
import { setCampaignAuthCookie } from '@/utilities/campaignAuth'
import {
  campaignJsonMutationErrorResponse,
  parseCampaignJsonRequestBody,
} from '@/utilities/campaignJsonMutationRoute'
import {
  campaignWebAuthnSafeMessages,
  completeCampaignAuthentication,
} from '@/utilities/campaignWebAuthnCeremony'
import { CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE } from '@/utilities/campaignWebAuthnChallenge'
import {
  CAMPAIGN_WEBAUTHN_ACCOUNT_LOCKED_MESSAGE,
  CAMPAIGN_WEBAUTHN_ACCOUNT_UNAVAILABLE_MESSAGE,
} from '@/utilities/campaignWebAuthnSession'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

export const dynamic = 'force-dynamic'

/**
 * Password-less sign-in. Anonymous on the way in and holding a `campaign-token`
 * on the way out, with the same 14-day TTL the "Lembrar de mim" checkbox grants
 * — enrolling the passkey on this device *is* the trust opt-in.
 */
export async function POST(request: Request): Promise<NextResponse<CampaignWebAuthnLoginResponse>> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ status: 'error', message: 'Requisição inválida.' }, { status: 403 })
  }

  const parsed = await parseCampaignJsonRequestBody(request)
  if (!parsed.ok) return parsed.response

  try {
    const { credential } = campaignWebAuthnLoginSchema.parse(parsed.body)
    const payload = await getPayload({ config })
    const { token, tokenExpiration } = await completeCampaignAuthentication(payload, credential)
    await setCampaignAuthCookie(token, payload, tokenExpiration)

    return NextResponse.json({ status: 'success', redirectTo: '/campanha' })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: [
        ...campaignWebAuthnSafeMessages,
        CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE,
        CAMPAIGN_WEBAUTHN_ACCOUNT_UNAVAILABLE_MESSAGE,
        CAMPAIGN_WEBAUTHN_ACCOUNT_LOCKED_MESSAGE,
      ],
      genericMessage: 'Não foi possível entrar com a biometria. Use sua senha.',
    })
  }
}
