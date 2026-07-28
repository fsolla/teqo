import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server'
import { NextResponse } from 'next/server'

import type { CampaignWebAuthnOptionsResponse } from '@/lib/campaignWebAuthn'
import { campaignWebAuthnNoBodySchema } from '@/lib/schemas/campaignWebAuthn'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import {
  buildCampaignAuthenticationOptions,
  campaignWebAuthnSafeMessages,
} from '@/utilities/campaignWebAuthnCeremony'

export const dynamic = 'force-dynamic'

type ResponseBody = CampaignWebAuthnOptionsResponse<PublicKeyCredentialRequestOptionsJSON>

/**
 * Anonymous by design: the challenge is issued before anybody is identified, and
 * because the passkey is discoverable the response carries no `allowCredentials`
 * — so this endpoint cannot be used to probe whether an account exists.
 */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: campaignWebAuthnNoBodySchema,
    safeMessages: campaignWebAuthnSafeMessages,
    genericMessage: 'Não foi possível iniciar a entrada por biometria. Use sua senha.',
  },
  async (): Promise<NextResponse<ResponseBody>> => {
    const options = await buildCampaignAuthenticationOptions()

    return NextResponse.json({ status: 'success', options })
  },
)
