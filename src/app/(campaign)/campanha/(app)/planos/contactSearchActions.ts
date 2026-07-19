'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import type { ContactComboboxOption } from '@/components/campaign/ContactCombobox'
import {
  isContactSearchQueryReady,
  normalizeContactSearchQuery,
} from '@/lib/contactSearchQuery'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { searchActionPlanLeadershipOptions } from '@/utilities/actionPlanLeadershipOptions'

const CONTACT_OPTION_LIMIT = 20

export const searchActionPlanContactOptions = async (
  query: string,
): Promise<ContactComboboxOption[]> => {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) throw new Error('Autenticação necessária.')

  const normalizedQuery = typeof query === 'string' ? query : ''
  if (!isContactSearchQueryReady(normalizedQuery)) return []

  const { trimmed, digits } = normalizeContactSearchQuery(normalizedQuery)

  const result = await payload.find({
    collection: 'contact',
    where: {
      or: [{ name: { contains: trimmed } }, { phone: { contains: digits || trimmed } }],
    },
    depth: 0,
    limit: CONTACT_OPTION_LIMIT,
    page: 1,
    sort: 'name',
    select: { name: true, phone: true },
    user,
    overrideAccess: false,
  })

  return result.docs.map(({ id, name, phone }) => ({ id, name, phone }))
}

export const searchActionPlanLeadershipOptionsAction = async (
  query: string,
): Promise<Array<{ id: number; label: string }>> => {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) throw new Error('Autenticação necessária.')

  return searchActionPlanLeadershipOptions(payload, user, query)
}
