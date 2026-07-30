import 'server-only'

import type { Payload } from 'payload'

import { homeSearchQueryIsActive, normalizeHomeSearchRaw } from '@/lib/campaignHomeSearchContract'
import {
  toHomeSearchMunicipalityHit,
  type HomeSearchMunicipalityHit,
} from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_STAFF_ONLY_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import {
  compareHomeSearchNameRelevance,
  normalizeHomeSearchName,
} from '@/lib/homeSearchMunicipalityMatch'
import { matchesNormalizedAtWordStart } from '@/lib/wordStartFilter'
import type { CampaignUser } from '@/payload-types'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'

export const searchStaffMunicipalityHits = async (
  payload: Payload,
  user: CampaignUser,
  rawQuery: string,
): Promise<HomeSearchMunicipalityHit[]> => {
  if (!isStaffCampaignRole(user.role)) {
    throw new Error(HOME_SEARCH_STAFF_ONLY_MESSAGE)
  }

  const query = normalizeHomeSearchRaw(rawQuery)
  if (!homeSearchQueryIsActive(query)) {
    return []
  }

  const normalizedQuery = normalizeHomeSearchName(query)
  const { municipalities } = await loadMunicipalityScope(payload, user, {})

  return municipalities
    .map((doc) => {
      const normalizedName = normalizeHomeSearchName(doc.name)
      if (!matchesNormalizedAtWordStart(normalizedName, normalizedQuery)) {
        return null
      }
      return {
        normalizedName,
        hit: toHomeSearchMunicipalityHit(doc),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) =>
      compareHomeSearchNameRelevance(
        {
          normalizedName: left.normalizedName,
          tieBreakDesc: left.hit.votePosition2022?.votes ?? 0,
        },
        {
          normalizedName: right.normalizedName,
          tieBreakDesc: right.hit.votePosition2022?.votes ?? 0,
        },
        normalizedQuery,
      ),
    )
    .map((row) => row.hit)
}
