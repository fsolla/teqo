import 'server-only'

import type { Payload } from 'payload'

import { homeSearchQueryIsActive, normalizeHomeSearchRaw } from '@/lib/campaignHomeSearchContract'
import type { HomeSearchActivityHit } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_STAFF_ONLY_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import {
  compareHomeSearchNameRelevance,
  normalizeHomeSearchName,
} from '@/lib/homeSearchMunicipalityMatch'
import { matchesNormalizedAtWordStart } from '@/lib/wordStartFilter'
import type { Activity, CampaignUser } from '@/payload-types'
import {
  activityMunicipalitySummary,
  formatActivityHomeSearchSecondary,
} from '@/utilities/activityViewModels'

const HOME_SEARCH_ACTIVITY_HIT_CAP = 25

export const searchHomeActivities = async (
  payload: Payload,
  user: CampaignUser,
  rawQuery: string,
): Promise<HomeSearchActivityHit[]> => {
  if (!isStaffCampaignRole(user.role)) {
    throw new Error(HOME_SEARCH_STAFF_ONLY_MESSAGE)
  }

  const query = normalizeHomeSearchRaw(rawQuery)
  if (!homeSearchQueryIsActive(query)) {
    return []
  }

  const normalizedQuery = normalizeHomeSearchName(query)

  // List search uses `contains`; home search refines to word-start in memory (B51).
  const result = await payload.find({
    collection: 'activity',
    where: { title: { contains: query } },
    depth: 1,
    limit: 0,
    pagination: false,
    select: {
      id: true,
      title: true,
      slug: true,
      allDay: true,
      startAt: true,
      endAt: true,
      municipality: true,
    },
    user,
    overrideAccess: false,
  })

  const candidates: Array<{
    normalizedName: string
    tieBreakDesc: number
    hit: HomeSearchActivityHit
  }> = []

  for (const doc of result.docs as Activity[]) {
    const normalizedName = normalizeHomeSearchName(doc.title)
    if (!matchesNormalizedAtWordStart(normalizedName, normalizedQuery)) {
      continue
    }

    const municipalityName = activityMunicipalitySummary(doc.municipality)?.name ?? null

    const tieBreakDesc = doc.startAt ? Date.parse(doc.startAt) : 0

    candidates.push({
      normalizedName,
      tieBreakDesc: Number.isFinite(tieBreakDesc) ? tieBreakDesc : 0,
      hit: {
        id: doc.id,
        slug: doc.slug,
        title: doc.title,
        secondary: formatActivityHomeSearchSecondary(municipalityName, doc.startAt, {
          allDay: doc.allDay,
          endAt: doc.endAt,
        }),
      },
    })
  }

  return candidates
    .sort((left, right) => compareHomeSearchNameRelevance(left, right, normalizedQuery))
    .slice(0, HOME_SEARCH_ACTIVITY_HIT_CAP)
    .map((row) => row.hit)
}
