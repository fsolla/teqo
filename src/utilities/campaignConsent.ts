import 'server-only'

import type { Payload } from 'payload'

import {
  CAMPAIGN_INVITE_CONSENT_KEY,
  SUPPORTER_REGISTRATION_CONSENT_KEY,
  SUPPORTER_VOTE_INTENTION_CONSENT_KEY,
} from '@/lib/campaignConsentKeys'
import type { Consent } from '@/payload-types'
import { hashConsentContent } from '@/utilities/consentContentHash'

export {
  SUPPORTER_REGISTRATION_CONSENT_KEY,
  SUPPORTER_VOTE_INTENTION_CONSENT_KEY,
} from '@/lib/campaignConsentKeys'

export type ConsentDescriptor = {
  id: number
  text: Consent['text']
  contentHash: string
  key: string
}

/** @deprecated Prefer ConsentDescriptor — kept for leadership call sites. */
export type LeadershipConsentDescriptor = Omit<ConsentDescriptor, 'key'>

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

export const getConsentByKey = async (
  payload: Payload,
  key: string,
  req?: ConsentRequest,
): Promise<ConsentDescriptor | null> => {
  const result = await payload.find({
    collection: 'consent',
    where: { key: { equals: key } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { text: true, key: true },
    overrideAccess: true,
    req,
  })
  const consent = result.docs[0]
  if (!consent) return null

  return {
    id: consent.id,
    text: consent.text,
    contentHash: hashConsentContent(consent.text ?? null),
    key,
  }
}

export const requireConsentByKey = async (
  payload: Payload,
  key: string,
  req?: ConsentRequest,
  message = 'Consentimento ainda não configurado.',
): Promise<ConsentDescriptor> => {
  const consent = await getConsentByKey(payload, key, req)
  if (!consent) throw new Error(message)
  return consent
}

export const getLeadershipConsent = async (
  payload: Payload,
  req?: ConsentRequest,
): Promise<LeadershipConsentDescriptor | null> => {
  const consent = await getConsentByKey(payload, CAMPAIGN_INVITE_CONSENT_KEY, req)
  if (!consent) return null
  return { id: consent.id, text: consent.text, contentHash: consent.contentHash }
}

export const requireLeadershipConsent = async (
  payload: Payload,
  req?: ConsentRequest,
  message = 'Consentimento ainda não configurado.',
): Promise<LeadershipConsentDescriptor> => {
  const consent = await requireConsentByKey(payload, CAMPAIGN_INVITE_CONSENT_KEY, req, message)
  return { id: consent.id, text: consent.text, contentHash: consent.contentHash }
}

export const getSupporterRegistrationConsent = (
  payload: Payload,
  req?: ConsentRequest,
): Promise<ConsentDescriptor | null> =>
  getConsentByKey(payload, SUPPORTER_REGISTRATION_CONSENT_KEY, req)

export const requireSupporterRegistrationConsent = (
  payload: Payload,
  req?: ConsentRequest,
  message = 'Consentimento de cadastro de apoiador ainda não configurado.',
): Promise<ConsentDescriptor> =>
  requireConsentByKey(payload, SUPPORTER_REGISTRATION_CONSENT_KEY, req, message)

export const getSupporterVoteIntentionConsent = (
  payload: Payload,
  req?: ConsentRequest,
): Promise<ConsentDescriptor | null> =>
  getConsentByKey(payload, SUPPORTER_VOTE_INTENTION_CONSENT_KEY, req)

export const requireSupporterVoteIntentionConsent = (
  payload: Payload,
  req?: ConsentRequest,
  message = 'Consentimento de intenção de voto ainda não configurado.',
): Promise<ConsentDescriptor> =>
  requireConsentByKey(payload, SUPPORTER_VOTE_INTENTION_CONSENT_KEY, req, message)
