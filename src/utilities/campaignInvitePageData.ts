import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import type { Consent } from '@/payload-types'
import { getLeadershipConsent } from '@/utilities/campaignConsent'
import type { CampaignInviteKind } from '@/utilities/campaignInvite'
import { findActiveCampaignInvite } from '@/utilities/campaignInviteRepository'

type CampaignInviteProfile = {
  name: string
  phone: string
  email: string | null
  gender: 'feminino' | 'masculino' | 'outro' | 'nao_informado' | null
}

export type CampaignInvitePageData =
  | { status: 'invalid' }
  | {
      status: 'valid'
      kind: CampaignInviteKind
      profile: CampaignInviteProfile
      requiresConsent: boolean
      consentData: Consent['text']
    }

const invalidInvite = (): CampaignInvitePageData => ({ status: 'invalid' })

export const getCampaignInviteConsentState = async (
  payload: Payload,
): Promise<{ configured: boolean }> => ({
  configured: Boolean(await getLeadershipConsent(payload)),
})

export const getCampaignInvitePageData = async (
  payload: Payload,
  token: string,
): Promise<CampaignInvitePageData> => {
  if (token.length < 20 || token.length > 256) return invalidInvite()

  try {
    const invite = await findActiveCampaignInvite(payload, token)
    const leadershipID = relationshipId(invite?.leadership)
    if (!invite || leadershipID === null) return invalidInvite()

    // Intentional admin bypass (this read and the contact read below): the
    // invitee is ANONYMOUS — the signed token resolved above is the
    // authorization, and the page must render the invited person's own data
    // before any session exists.
    const leadership = await payload.findByID({
      collection: 'leadership',
      id: leadershipID,
      depth: 0,
      select: {
        contact: true,
        supportStatus: true,
        consent: true,
        consentContentHash: true,
      },
      overrideAccess: true,
    })
    if (invite.kind === 'login' && leadership.supportStatus !== 'engajado') {
      return invalidInvite()
    }

    const contactID = relationshipId(leadership.contact)
    if (contactID === null) return invalidInvite()
    const [contact, consent] = await Promise.all([
      payload.findByID({
        collection: 'contact',
        id: contactID,
        depth: 0,
        select: {
          name: true,
          phone: true,
          email: true,
          gender: true,
        },
        // Intentional admin bypass: same anonymous-invitee policy as the
        // leadership read above — the token is the authorization.
        overrideAccess: true,
      }),
      getLeadershipConsent(payload),
    ])
    if (!consent) return invalidInvite()
    return {
      status: 'valid',
      kind: invite.kind,
      profile: {
        name: contact.name,
        phone: contact.phone ?? '',
        email: contact.email ?? null,
        gender: contact.gender ?? null,
      },
      requiresConsent:
        relationshipId(leadership.consent) !== consent.id ||
        leadership.consentContentHash !== consent.contentHash,
      consentData: consent.text,
    }
  } catch {
    return invalidInvite()
  }
}
