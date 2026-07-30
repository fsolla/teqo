import 'server-only'

import type { Payload } from 'payload'

import {
  HOME_SEARCH_RESULT_HIT_CAP,
  homeSearchQueryIsActive,
  normalizeHomeSearchRaw,
} from '@/lib/campaignHomeSearchContract'
import type { HomeSearchLeadershipHit } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_STAFF_ONLY_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import {
  compareHomeSearchNameRelevance,
  normalizeHomeSearchName,
} from '@/lib/homeSearchMunicipalityMatch'
import { populatedContactName } from '@/lib/relationship'
import { matchesNormalizedAtWordStart } from '@/lib/wordStartFilter'
import type { CampaignUser, Leadership } from '@/payload-types'
import { truncatedNamesLabel } from '@/utilities/campaignListUrl'
import { buildLeadershipListWhere } from '@/utilities/leadership/leadershipListUrl'

const municipalityNamesFromLeadership = (doc: Leadership): string[] => {
  const names = new Set<string>()
  for (const municipality of doc.municipalities ?? []) {
    if (typeof municipality === 'object' && municipality !== null && 'name' in municipality) {
      const name = municipality.name
      if (typeof name === 'string' && name.length > 0) names.add(name)
    }
  }
  return [...names].sort((left, right) => left.localeCompare(right, 'pt-BR'))
}

export const searchHomeLeaderships = async (
  payload: Payload,
  user: CampaignUser,
  rawQuery: string,
): Promise<HomeSearchLeadershipHit[]> => {
  if (!isStaffCampaignRole(user.role)) {
    throw new Error(HOME_SEARCH_STAFF_ONLY_MESSAGE)
  }

  const query = normalizeHomeSearchRaw(rawQuery)
  if (!homeSearchQueryIsActive(query)) {
    return []
  }

  const normalizedQuery = normalizeHomeSearchName(query)

  // List search uses `contains`; home search refines to word-start in memory (B49).
  const result = await payload.find({
    collection: 'leadership',
    where: buildLeadershipListWhere({ page: 1, q: query }),
    depth: 1,
    limit: 0,
    pagination: false,
    select: {
      id: true,
      updatedAt: true,
      contact: true,
      municipalities: true,
    },
    user,
    overrideAccess: false,
  })

  const candidates: Array<{
    normalizedName: string
    tieBreakDesc: number
    id: number
    name: string
    municipalityNames: string[]
  }> = []

  for (const doc of result.docs as Leadership[]) {
    const name = populatedContactName(doc.contact)
    const normalizedName = normalizeHomeSearchName(name)
    if (!matchesNormalizedAtWordStart(normalizedName, normalizedQuery)) {
      continue
    }
    const tieBreakDesc = Date.parse(doc.updatedAt)
    candidates.push({
      normalizedName,
      tieBreakDesc: Number.isFinite(tieBreakDesc) ? tieBreakDesc : 0,
      id: doc.id,
      name,
      municipalityNames: municipalityNamesFromLeadership(doc),
    })
  }

  return candidates
    .sort((left, right) => compareHomeSearchNameRelevance(left, right, normalizedQuery))
    .slice(0, HOME_SEARCH_RESULT_HIT_CAP)
    .map(
      (row): HomeSearchLeadershipHit => ({
        kind: 'leadership',
        id: row.id,
        name: row.name,
        municipalitiesSummary: truncatedNamesLabel(row.municipalityNames),
      }),
    )
}
