'use server'

import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import type {
  CampaignInviteAutofillInput,
  CampaignInviteCreateInput,
  CampaignInviteLoginInput,
} from '@/lib/schemas/invite'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { setCampaignAuthCookie } from '@/utilities/campaignAuth'
import { createCampaignInviteForActor } from '@/utilities/campaignInviteCreation'
import { getCampaignInviteBaseURL } from '@/utilities/campaignInviteOrigin'
import {
  redeemCampaignInviteAutofillRecord,
  redeemCampaignInviteLoginRecord,
} from '@/utilities/campaignInviteRedemption'

export const createCampaignInvite = async (input: CampaignInviteCreateInput) => {
  const [{ payload, actor }, requestHeaders] = await Promise.all([
    getCampaignActionContext(),
    headers(),
  ])
  const inviteBaseURL = getCampaignInviteBaseURL({
    requestOrigin: requestHeaders.get('origin'),
    forwardedHost: requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
    forwardedProto: requestHeaders.get('x-forwarded-proto'),
  })
  return createCampaignInviteForActor(payload, actor, input, inviteBaseURL)
}

export const redeemCampaignInviteAutofill = async (input: CampaignInviteAutofillInput) => {
  const payload = await getPayload({ config })
  return redeemCampaignInviteAutofillRecord(payload, input)
}

export const redeemCampaignInviteLogin = async (input: CampaignInviteLoginInput) => {
  const payload = await getPayload({ config })
  const result = await redeemCampaignInviteLoginRecord(payload, input)
  await setCampaignAuthCookie(result.token, payload)
  return { ok: true as const }
}
