import 'server-only'

import type { Payload } from 'payload'

import {
  HOME_SEARCH_RESULT_HIT_CAP,
  homeSearchQueryIsActive,
  normalizeHomeSearchRaw,
} from '@/lib/campaignHomeSearchContract'
import type { HomeSearchStateDeputyHit } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_STAFF_ONLY_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import {
  compareHomeSearchNameRelevance,
  normalizeHomeSearchName,
} from '@/lib/homeSearchMunicipalityMatch'
import { matchesNormalizedAtWordStart } from '@/lib/wordStartFilter'
import type { CampaignUser } from '@/payload-types'
import { municipalityIdsByStateDeputyIds } from '@/utilities/stateDeputyData'

export const searchHomeStateDeputies = async (
  payload: Payload,
  user: CampaignUser,
  rawQuery: string,
): Promise<HomeSearchStateDeputyHit[]> => {
  if (!isStaffCampaignRole(user.role)) {
    throw new Error(HOME_SEARCH_STAFF_ONLY_MESSAGE)
  }

  const query = normalizeHomeSearchRaw(rawQuery)
  if (!homeSearchQueryIsActive(query)) {
    return []
  }

  const normalizedQuery = normalizeHomeSearchName(query)

  // List search uses `contains` on name; home search also pre-filters party
  // then refines to word-start in memory (B49 precedent).
  const result = await payload.find({
    collection: 'stateDeputy',
    where: {
      or: [{ name: { contains: query } }, { party: { contains: query } }],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true, slug: true, party: true },
    user,
    overrideAccess: false,
  })

  const candidates: Array<{
    normalizedName: string
    slug: string
    name: string
    party: string | null
    id: number
  }> = []

  for (const doc of result.docs) {
    const normalizedName = normalizeHomeSearchName(doc.name)
    const normalizedParty = doc.party ? normalizeHomeSearchName(doc.party) : ''
    const nameMatch = matchesNormalizedAtWordStart(normalizedName, normalizedQuery)
    const partyMatch =
      normalizedParty.length > 0 && matchesNormalizedAtWordStart(normalizedParty, normalizedQuery)
    if (!nameMatch && !partyMatch) continue

    candidates.push({
      normalizedName: nameMatch ? normalizedName : normalizedParty,
      slug: doc.slug,
      name: doc.name,
      party: doc.party ?? null,
      id: doc.id,
    })
  }

  if (candidates.length === 0) {
    return []
  }

  const municipalityIdsByDeputy = await municipalityIdsByStateDeputyIds(
    payload,
    candidates.map((row) => row.id),
  )

  return candidates
    .map((row) => {
      const municipalityCount = municipalityIdsByDeputy.get(row.id)?.length ?? 0
      return {
        normalizedName: row.normalizedName,
        tieBreakDesc: municipalityCount,
        hit: {
          slug: row.slug,
          name: row.name,
          party: row.party,
          municipalityCount,
        },
      }
    })
    .sort((left, right) =>
      compareHomeSearchNameRelevance(
        {
          normalizedName: left.normalizedName,
          tieBreakDesc: left.tieBreakDesc,
        },
        {
          normalizedName: right.normalizedName,
          tieBreakDesc: right.tieBreakDesc,
        },
        normalizedQuery,
      ),
    )
    .slice(0, HOME_SEARCH_RESULT_HIT_CAP)
    .map((row) => row.hit)
}
