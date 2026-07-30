import 'server-only'

import type { Payload } from 'payload'

import { homeSearchQueryIsActive, normalizeHomeSearchRaw } from '@/lib/campaignHomeSearchContract'
import type { HomeSearchDemandHit } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_STAFF_ONLY_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import {
  compareHomeSearchNameRelevance,
  normalizeHomeSearchName,
} from '@/lib/homeSearchMunicipalityMatch'
import { isPopulatedRelationship } from '@/lib/relationship'
import { campaignDemandStatusLabels, type CampaignDemandStatus } from '@/lib/schemas/campaignDemand'
import { matchesNormalizedAtWordStart } from '@/lib/wordStartFilter'
import type { CampaignDemand, CampaignUser, Municipality } from '@/payload-types'

const HOME_SEARCH_DEMAND_HIT_CAP = 25

export const formatDemandHomeSearchSecondary = (
  municipalityName: string | null,
  status: CampaignDemandStatus,
): string => {
  const statusLabel = campaignDemandStatusLabels[status]
  if (!municipalityName) return statusLabel
  return `${municipalityName} · ${statusLabel}`
}

export const searchHomeDemands = async (
  payload: Payload,
  user: CampaignUser,
  rawQuery: string,
): Promise<HomeSearchDemandHit[]> => {
  if (!isStaffCampaignRole(user.role)) {
    throw new Error(HOME_SEARCH_STAFF_ONLY_MESSAGE)
  }

  const query = normalizeHomeSearchRaw(rawQuery)
  if (!homeSearchQueryIsActive(query)) {
    return []
  }

  const normalizedQuery = normalizeHomeSearchName(query)

  const result = await payload.find({
    collection: 'campaignDemand',
    where: { title: { contains: query } },
    depth: 1,
    limit: 0,
    pagination: false,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      municipality: true,
      createdAt: true,
    },
    user,
    overrideAccess: false,
  })

  const candidates: Array<{
    normalizedName: string
    tieBreakDesc: number
    hit: HomeSearchDemandHit
  }> = []

  for (const doc of result.docs as CampaignDemand[]) {
    const normalizedName = normalizeHomeSearchName(doc.title)
    if (!matchesNormalizedAtWordStart(normalizedName, normalizedQuery)) {
      continue
    }

    const municipalityName = isPopulatedRelationship<Municipality>(doc.municipality)
      ? doc.municipality.name
      : null

    const tieBreakDesc = doc.createdAt ? Date.parse(doc.createdAt) : 0

    candidates.push({
      normalizedName,
      tieBreakDesc: Number.isFinite(tieBreakDesc) ? tieBreakDesc : 0,
      hit: {
        id: doc.id,
        slug: doc.slug,
        title: doc.title,
        secondary: formatDemandHomeSearchSecondary(
          municipalityName,
          doc.status as CampaignDemandStatus,
        ),
      },
    })
  }

  return candidates
    .sort((left, right) => compareHomeSearchNameRelevance(left, right, normalizedQuery))
    .slice(0, HOME_SEARCH_DEMAND_HIT_CAP)
    .map((row) => row.hit)
}
