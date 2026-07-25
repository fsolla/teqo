import 'server-only'

import type { Payload } from 'payload'

import type { Consent, Leadership } from '@/payload-types'
import { getLeadershipConsent } from '@/utilities/campaignConsent'
import type { CampaignInviteKind } from '@/utilities/campaignInvite'
import { findActiveCampaignInvite } from '@/utilities/campaignInviteRepository'
import { relationshipId } from '@/utilities/relationship'

type CampaignInviteProfile = {
  name: string
  phone: string
  email: string | null
  gender: 'feminino' | 'masculino' | 'outro' | 'nao_informado' | null
  sector: Leadership['sector'] | null
  sectorNotes: string | null
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

    const leadership = await payload.findByID({
      collection: 'leadership',
      id: leadershipID,
      depth: 0,
      select: {
        contact: true,
        sector: true,
        sectorNotes: true,
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
        sector: leadership.sector ?? null,
        sectorNotes: leadership.sectorNotes ?? null,
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
