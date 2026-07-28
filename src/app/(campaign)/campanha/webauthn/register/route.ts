import { NextResponse } from 'next/server'

import {
  CAMPAIGN_BIOMETRIC_ENROLL_ERROR_MESSAGE,
  CAMPAIGN_BIOMETRIC_ENROLLED_MESSAGE,
} from '@/lib/campaignAuthCopy'
import type { CampaignWebAuthnRegisterResponse } from '@/lib/campaignWebAuthn'
import { campaignWebAuthnRegisterSchema } from '@/lib/schemas/campaignWebAuthn'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import {
  campaignJsonMutationErrorResponse,
  parseCampaignJsonRequestBody,
} from '@/utilities/campaignJsonMutationRoute'
import {
  campaignWebAuthnSafeMessages,
  completeCampaignRegistration,
} from '@/utilities/campaignWebAuthnCeremony'
import { CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE } from '@/utilities/campaignWebAuthnChallenge'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
): Promise<NextResponse<CampaignWebAuthnRegisterResponse>> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ status: 'error', message: 'Requisição inválida.' }, { status: 403 })
  }

  const parsed = await parseCampaignJsonRequestBody(request)
  if (!parsed.ok) return parsed.response

  try {
    const { credential, deviceLabel } = campaignWebAuthnRegisterSchema.parse(parsed.body)
    const { payload, actor } = await getCampaignActionContext()
    const passkey = await completeCampaignRegistration(payload, actor, { credential, deviceLabel })

    return NextResponse.json({
      status: 'success',
      message: CAMPAIGN_BIOMETRIC_ENROLLED_MESSAGE,
      passkey,
    })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: [...campaignWebAuthnSafeMessages, CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE],
      genericMessage: CAMPAIGN_BIOMETRIC_ENROLL_ERROR_MESSAGE,
    })
  }
}
