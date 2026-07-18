import 'server-only'

import type { Payload } from 'payload'

import type { Consent } from '@/payload-types'
import { CAMPAIGN_INVITE_CONSENT_KEY } from '@/utilities/campaignInvite'
import { hashConsentContent } from '@/utilities/consentContentHash'

export type LeadershipConsentDescriptor = {
  id: number
  text: Consent['text']
  contentHash: string
}

type ConsentRequest = { transactionID?: number | string }

export type InviteConsentResolution =
  | { shouldUpdate: false }
  | {
      shouldUpdate: true
      consentID: number
      consentContentHash: string
      consentedAt: string
    }

export const resolveInviteConsent = ({
  existingConsentID,
  existingConsentContentHash,
  configuredConsentID,
  configuredConsentContentHash,
  consentAccepted,
}: {
  existingConsentID: number | null
  existingConsentContentHash?: string | null
  configuredConsentID: number
  configuredConsentContentHash: string
  consentAccepted?: boolean
}): InviteConsentResolution => {
  if (
    existingConsentID === configuredConsentID &&
    existingConsentContentHash === configuredConsentContentHash
  ) {
    return { shouldUpdate: false }
  }
  if (!consentAccepted) {
    throw new Error('É necessário aceitar o consentimento.')
  }
  return {
    shouldUpdate: true,
    consentID: configuredConsentID,
    consentContentHash: configuredConsentContentHash,
    consentedAt: new Date().toISOString(),
  }
}

export const getLeadershipConsent = async (
  payload: Payload,
  req?: ConsentRequest,
): Promise<LeadershipConsentDescriptor | null> => {
  const result = await payload.find({
    collection: 'consent',
    where: { key: { equals: CAMPAIGN_INVITE_CONSENT_KEY } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { text: true },
    overrideAccess: true,
    req,
  })
  const consent = result.docs[0]
  if (!consent) return null

  return {
    id: consent.id,
    text: consent.text,
    contentHash: hashConsentContent(consent.text ?? null),
  }
}

export const requireLeadershipConsent = async (
  payload: Payload,
  req?: ConsentRequest,
  message = 'Consentimento ainda não configurado.',
): Promise<LeadershipConsentDescriptor> => {
  const consent = await getLeadershipConsent(payload, req)
  if (!consent) throw new Error(message)
  return consent
}
