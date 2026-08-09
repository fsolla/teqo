import 'server-only'

import type { Payload } from 'payload'

import { homeSearchQueryIsActive, normalizeHomeSearchRaw } from '@/lib/campaignHomeSearchContract'
import {
  type HomeSearchSuccessResponse,
  type HomeSearchTerritoryHit,
} from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_STAFF_ONLY_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import {
  compareHomeSearchNameRelevance,
  normalizeHomeSearchName,
} from '@/lib/homeSearchMunicipalityMatch'
import { DEFAULT_VOTE_RANK_YEAR } from '@/lib/municipalityVoteRank'
import { matchesNormalizedAtWordStart } from '@/lib/wordStartFilter'
import type { CampaignUser } from '@/payload-types'
import { loadTerritoryOverview } from '@/utilities/territory/loadTerritoryOverview'

import { searchStaffMunicipalityHits } from './searchStaffMunicipalityHits'

const emptyResponse = (): HomeSearchSuccessResponse => ({
  status: 'success',
  resultKind: 'search',
  municipalities: [],
  territories: [],
  advisors: [],
  leaderships: [],
  stateDeputies: [],
  activities: [],
  demands: [],
})

export const searchHomeMunicipalities = async (
  payload: Payload,
  user: CampaignUser,
  rawQuery: string,
): Promise<HomeSearchSuccessResponse> => {
  if (!isStaffCampaignRole(user.role)) {
    throw new Error(HOME_SEARCH_STAFF_ONLY_MESSAGE)
  }

  const query = normalizeHomeSearchRaw(rawQuery)
  if (!homeSearchQueryIsActive(query)) {
    return emptyResponse()
  }

  const normalizedQuery = normalizeHomeSearchName(query)

  const [municipalityHits, territoryOverview] = await Promise.all([
    searchStaffMunicipalityHits(payload, user, query),
    loadTerritoryOverview(payload, user),
  ])
  const territoryRows = territoryOverview.rows
  const territoryHits: HomeSearchTerritoryHit[] = territoryRows
    .map((row) => {
      const normalizedName = normalizeHomeSearchName(row.region)
      if (!matchesNormalizedAtWordStart(normalizedName, normalizedQuery)) {
        return null
      }
      return {
        normalizedName,
        hit: {
          kind: 'territory' as const,
          region: row.region,
          votes2022: row.votesByYear[DEFAULT_VOTE_RANK_YEAR] ?? 0,
        },
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) =>
      compareHomeSearchNameRelevance(
        {
          normalizedName: left.normalizedName,
          tieBreakDesc: left.hit.votes2022,
        },
        {
          normalizedName: right.normalizedName,
          tieBreakDesc: right.hit.votes2022,
        },
        normalizedQuery,
      ),
    )
    .map((row) => row.hit)

  return {
    status: 'success',
    resultKind: 'search',
    municipalities: municipalityHits,
    territories: territoryHits,
    advisors: [],
    leaderships: [],
    stateDeputies: [],
    activities: [],
    demands: [],
  }
}
