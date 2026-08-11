'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import type { ContactComboboxOption } from '@/components/campaign/shared/ContactCombobox'
import { isContactSearchQueryReady, normalizeContactSearchQuery } from '@/lib/contactSearchQuery'
import { primaryPhoneOf } from '@/lib/phone'
import {
  searchActivityResponsibleOptions,
  type ActivityResponsibleSearchOption,
} from '@/utilities/activityResponsibleSearch'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { CAMPAIGN_AUTH_REQUIRED_MESSAGE } from '@/utilities/campaignFormActionError'

const CONTACT_OPTION_LIMIT = 20

export const searchActivityContactOptions = async (
  query: string,
): Promise<ContactComboboxOption[]> => {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) throw new Error(CAMPAIGN_AUTH_REQUIRED_MESSAGE)

  const normalizedQuery = typeof query === 'string' ? query : ''
  if (!isContactSearchQueryReady(normalizedQuery)) return []

  const { trimmed, digits } = normalizeContactSearchQuery(normalizedQuery)

  const result = await payload.find({
    collection: 'contact',
    where: {
      or: [{ name: { contains: trimmed } }, { 'phones.value': { contains: digits || trimmed } }],
    },
    depth: 0,
    limit: CONTACT_OPTION_LIMIT,
    page: 1,
    sort: 'name',
    select: { name: true, phones: { value: true } },
    user,
    overrideAccess: false,
  })

  return result.docs.map(({ id, name, phones }) => ({
    id,
    name,
    phone: primaryPhoneOf(phones),
  }))
}

export const searchActivityResponsibleOptionsAction = async (
  query: string,
): Promise<ActivityResponsibleSearchOption[]> => {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) throw new Error(CAMPAIGN_AUTH_REQUIRED_MESSAGE)

  return searchActivityResponsibleOptions(payload, user, query)
}
