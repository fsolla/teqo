import 'server-only'

import type { Payload } from 'payload'

import { homeSearchQueryIsActive, normalizeHomeSearchRaw } from '@/lib/campaignHomeSearchContract'
import type { HomeSearchAdvisorHit } from '@/lib/campaignHomeSearchHits'
import { isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import {
  compareHomeSearchNameRelevance,
  normalizeHomeSearchName,
} from '@/lib/homeSearchMunicipalityMatch'
import { matchesNormalizedAtWordStart } from '@/lib/wordStartFilter'
import type { CampaignUser } from '@/payload-types'
import { municipalityIdsByAdvisorIds } from '@/utilities/advisorData'

export const searchHomeAdvisors = async (
  payload: Payload,
  user: CampaignUser,
  rawQuery: string,
): Promise<HomeSearchAdvisorHit[]> => {
  if (!isUnrestrictedCampaignRole(user.role)) {
    return []
  }

  const query = normalizeHomeSearchRaw(rawQuery)
  if (!homeSearchQueryIsActive(query)) {
    return []
  }

  const normalizedQuery = normalizeHomeSearchName(query)

  // Under access (`overrideAccess: false`): the unrestricted-staff gate ran
  // above, so the advisor directory is only queried for coordinator/candidate.
  const result = await payload.find({
    collection: 'campaignUser',
    where: { role: { equals: 'advisor' } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true, phone: true },
    user,
    overrideAccess: false,
  })

  const matched = result.docs
    .map((doc) => {
      const normalizedName = normalizeHomeSearchName(doc.name)
      if (!matchesNormalizedAtWordStart(normalizedName, normalizedQuery)) {
        return null
      }
      return {
        id: doc.id,
        name: doc.name,
        phone: doc.phone ?? null,
        normalizedName,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (matched.length === 0) {
    return []
  }

  const advisorIDs = matched.map((row) => row.id)
  const municipalityIdsByAdvisor = await municipalityIdsByAdvisorIds(payload, advisorIDs)

  return matched
    .map((row) => ({
      normalizedName: row.normalizedName,
      hit: {
        id: row.id,
        name: row.name,
        phone: row.phone,
        municipalityCount: municipalityIdsByAdvisor.get(row.id)?.length ?? 0,
      },
    }))
    .sort((left, right) =>
      compareHomeSearchNameRelevance(
        {
          normalizedName: left.normalizedName,
          tieBreakDesc: left.hit.municipalityCount,
        },
        {
          normalizedName: right.normalizedName,
          tieBreakDesc: right.hit.municipalityCount,
        },
        normalizedQuery,
      ),
    )
    .map((row) => row.hit)
}
