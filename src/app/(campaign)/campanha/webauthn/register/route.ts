import { NextResponse } from 'next/server'

import {
  CAMPAIGN_BIOMETRIC_ENROLL_ERROR_MESSAGE,
  CAMPAIGN_BIOMETRIC_ENROLLED_MESSAGE,
} from '@/lib/campaignAuthCopy'
import type { CampaignWebAuthnRegisterResponse } from '@/lib/campaignWebAuthn'
import { campaignWebAuthnRegisterSchema } from '@/lib/schemas/campaignWebAuthn'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import {
  campaignWebAuthnSafeMessages,
  completeCampaignRegistration,
} from '@/utilities/campaignWebAuthnCeremony'
import { CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE } from '@/utilities/campaignWebAuthnChallenge'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: campaignWebAuthnRegisterSchema,
    safeMessages: [...campaignWebAuthnSafeMessages, CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE],
    genericMessage: CAMPAIGN_BIOMETRIC_ENROLL_ERROR_MESSAGE,
  },
  async ({ credential, deviceLabel }): Promise<NextResponse<CampaignWebAuthnRegisterResponse>> => {
    const { payload, actor } = await getCampaignActionContext()
    const passkey = await completeCampaignRegistration(payload, actor, { credential, deviceLabel })

    return NextResponse.json({
      status: 'success',
      message: CAMPAIGN_BIOMETRIC_ENROLLED_MESSAGE,
      passkey,
    })
  },
)
