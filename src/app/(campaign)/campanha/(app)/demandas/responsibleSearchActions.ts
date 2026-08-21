'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { eligibleCampaignStaffWhere } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { CAMPAIGN_AUTH_REQUIRED_MESSAGE } from '@/utilities/campaignFormActionError'
import { loadCampaignUserSummaries } from '@/utilities/campaignRelationOptions'

const RESPONSIBLE_SEARCH_LIMIT = 20

/**
 * C143 — candidate catalog for the demand responsible picker. Short queries
 * (or empty) return the municipality's advisors as suggestions — a fill-in
 * shortcut, never an automatic responsibility. Longer queries search staff by
 * name. Both paths run access-scoped reads (`overrideAccess: false`), so the
 * catalog only ever offers what the actor may already read.
 */
export const searchDemandResponsibleOptions = async (
  query: string,
  municipalityId: number | null,
): Promise<RelationOption[]> => {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) throw new Error(CAMPAIGN_AUTH_REQUIRED_MESSAGE)

  if (query.trim().length < 2) {
    if (!municipalityId) return []

    const municipality = await payload.find({
      collection: 'municipality',
      where: { id: { equals: municipalityId } },
      depth: 0,
      limit: 1,
      pagination: false,
      select: { advisors: true },
      user,
      overrideAccess: false,
    })
    const advisors = (municipality.docs[0]?.advisors ?? [])
      .map((advisor) => (typeof advisor === 'object' && advisor !== null ? advisor.id : advisor))
      .filter((id): id is number => Number.isInteger(id))
    return loadCampaignUserSummaries(payload, user, advisors)
  }

  const result = await payload.find({
    collection: 'campaignUser',
    where: {
      and: [{ name: { contains: query.trim() } }, eligibleCampaignStaffWhere],
    },
    depth: 0,
    limit: RESPONSIBLE_SEARCH_LIMIT,
    pagination: false,
    sort: 'name',
    select: { name: true },
    user,
    overrideAccess: false,
  })
  return result.docs.map(({ id, name }) => ({ id, name }))
}
