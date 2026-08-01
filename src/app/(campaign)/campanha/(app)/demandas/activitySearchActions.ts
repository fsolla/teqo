'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import type { AsyncSearchOption } from '@/components/campaign/shared/AsyncSearchCombobox'
import { searchActivityRelationOptions } from '@/utilities/activityRelationOptions'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { CAMPAIGN_AUTH_REQUIRED_MESSAGE } from '@/utilities/campaignFormActionError'

export const searchDemandActivityOptions = async (
  query: string,
  municipalityId: number | null,
): Promise<AsyncSearchOption[]> => {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) throw new Error(CAMPAIGN_AUTH_REQUIRED_MESSAGE)

  const options = await searchActivityRelationOptions(payload, user, query, municipalityId)
  return options.map((option) => ({ id: option.id, label: option.label }))
}
