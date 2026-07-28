import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server'
import { NextResponse } from 'next/server'

import type { CampaignWebAuthnOptionsResponse } from '@/lib/campaignWebAuthn'
import { campaignJsonMutationErrorResponse } from '@/utilities/campaignJsonMutationRoute'
import {
  buildCampaignAuthenticationOptions,
  campaignWebAuthnSafeMessages,
} from '@/utilities/campaignWebAuthnCeremony'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

export const dynamic = 'force-dynamic'

type ResponseBody = CampaignWebAuthnOptionsResponse<PublicKeyCredentialRequestOptionsJSON>

/**
 * Anonymous by design: the challenge is issued before anybody is identified, and
 * because the passkey is discoverable the response carries no `allowCredentials`
 * — so this endpoint cannot be used to probe whether an account exists.
 */
export async function POST(request: Request): Promise<NextResponse<ResponseBody>> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ status: 'error', message: 'Requisição inválida.' }, { status: 403 })
  }

  try {
    const options = await buildCampaignAuthenticationOptions()

    return NextResponse.json({ status: 'success', options })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: campaignWebAuthnSafeMessages,
      genericMessage: 'Não foi possível iniciar a entrada por biometria. Use sua senha.',
    })
  }
}
