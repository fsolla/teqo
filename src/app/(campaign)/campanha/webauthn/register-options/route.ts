import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server'
import { NextResponse } from 'next/server'

import type { CampaignWebAuthnOptionsResponse } from '@/lib/campaignWebAuthn'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { campaignJsonMutationErrorResponse } from '@/utilities/campaignJsonMutationRoute'
import {
  buildCampaignRegistrationOptions,
  campaignWebAuthnSafeMessages,
} from '@/utilities/campaignWebAuthnCeremony'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

export const dynamic = 'force-dynamic'

type ResponseBody = CampaignWebAuthnOptionsResponse<PublicKeyCredentialCreationOptionsJSON>

/**
 * Opens the enrollment ceremony for the signed-in account. Authenticated, so it
 * lives here rather than in `(app)`: two of the four WebAuthn routes are
 * anonymous by nature and the `/campanha` cookie path covers all of them.
 */
export async function POST(request: Request): Promise<NextResponse<ResponseBody>> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ status: 'error', message: 'Requisição inválida.' }, { status: 403 })
  }

  try {
    const { payload, actor } = await getCampaignActionContext()
    const options = await buildCampaignRegistrationOptions(payload, actor)

    return NextResponse.json({ status: 'success', options })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: campaignWebAuthnSafeMessages,
      genericMessage: 'Não foi possível iniciar o cadastro da biometria. Tente novamente.',
    })
  }
}
