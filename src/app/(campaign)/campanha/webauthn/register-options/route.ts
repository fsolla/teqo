import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server'
import { NextResponse } from 'next/server'

import type { CampaignWebAuthnOptionsResponse } from '@/lib/campaignWebAuthn'
import { campaignWebAuthnNoBodySchema } from '@/lib/schemas/campaignWebAuthn'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import {
  buildCampaignRegistrationOptions,
  campaignWebAuthnSafeMessages,
} from '@/utilities/campaignWebAuthnCeremony'

export const dynamic = 'force-dynamic'

type ResponseBody = CampaignWebAuthnOptionsResponse<PublicKeyCredentialCreationOptionsJSON>

/**
 * Opens the enrollment ceremony for the signed-in account. Authenticated, so it
 * lives here rather than in `(app)`: two of the four WebAuthn routes are
 * anonymous by nature and the `/campanha` cookie path covers all of them.
 */
export const POST = campaignJsonMutationRoute(
  {
    bodySchema: campaignWebAuthnNoBodySchema,
    safeMessages: campaignWebAuthnSafeMessages,
    genericMessage: 'Não foi possível iniciar o cadastro da biometria. Tente novamente.',
  },
  async (): Promise<NextResponse<ResponseBody>> => {
    const { payload, actor } = await getCampaignActionContext()
    const options = await buildCampaignRegistrationOptions(payload, actor)

    return NextResponse.json({ status: 'success', options })
  },
)
