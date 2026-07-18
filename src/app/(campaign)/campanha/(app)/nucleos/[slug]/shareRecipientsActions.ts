'use server'

import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { getCampaignUser } from '@/utilities/campaignAuth'
import { getCampaignInviteBaseURL } from '@/utilities/campaignInviteOrigin'
import {
  getNucleusShareRecipients,
  type NucleusShareRecipients,
} from '@/utilities/nucleusShareRecipients'

export type NucleusShareRecipientsResult = {
  recipients: NucleusShareRecipients
  nucleusUrl: string
}

export const loadNucleusShareRecipients = async (
  slug: string,
): Promise<NucleusShareRecipientsResult> => {
  const [payload, user, requestHeaders] = await Promise.all([
    getPayload({ config }),
    getCampaignUser(),
    headers(),
  ])
  if (!user) throw new Error('Faça login para compartilhar este núcleo.')

  const recipients = await getNucleusShareRecipients(payload, user, slug)
  const baseURL = getCampaignInviteBaseURL({
    requestOrigin: requestHeaders.get('origin'),
    forwardedHost: requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
    forwardedProto: requestHeaders.get('x-forwarded-proto'),
  })

  return {
    recipients,
    nucleusUrl: `${baseURL}/campanha/nucleos/${slug}`,
  }
}
