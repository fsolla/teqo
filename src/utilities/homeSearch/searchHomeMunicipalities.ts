import 'server-only'

import type { Payload } from 'payload'

import { homeSearchQueryIsActive, normalizeHomeSearchRaw } from '@/lib/campaignHomeSearchContract'
import type {
  HomeSearchMunicipalityHit,
  HomeSearchSuccessResponse,
  HomeSearchTerritoryHit,
} from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_STAFF_ONLY_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import {
  compareHomeSearchNameRelevance,
  normalizeHomeSearchName,
} from '@/lib/homeSearchMunicipalityMatch'
import { DEFAULT_VOTE_RANK_YEAR, getMunicipalityVoteRank } from '@/lib/municipalityVoteRank'
import { matchesNormalizedAtWordStart } from '@/lib/wordStartFilter'
import type { CampaignUser } from '@/payload-types'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'
import { loadTerritoryOverview } from '@/utilities/territory/loadTerritoryOverview'

const emptyResponse = (): HomeSearchSuccessResponse => ({
  status: 'success',
  municipalities: [],
  territories: [],
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

  const { municipalities } = await loadMunicipalityScope(payload, user, {})

  const municipalityHits: HomeSearchMunicipalityHit[] = municipalities
    .map((doc) => {
      const normalizedName = normalizeHomeSearchName(doc.name)
      if (!matchesNormalizedAtWordStart(normalizedName, normalizedQuery)) {
        return null
      }
      const votePosition2022 = getMunicipalityVoteRank(doc.slug, DEFAULT_VOTE_RANK_YEAR)
      return {
        normalizedName,
        hit: {
          kind: 'municipality' as const,
          slug: doc.slug,
          name: doc.name,
          region: doc.region,
          priority: doc.priority ?? null,
          votePosition2022,
        },
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) =>
      compareHomeSearchNameRelevance(
        {
          normalizedName: left.normalizedName,
          votes2022: left.hit.votePosition2022?.votes ?? 0,
        },
        {
          normalizedName: right.normalizedName,
          votes2022: right.hit.votePosition2022?.votes ?? 0,
        },
        normalizedQuery,
      ),
    )
    .map((row) => row.hit)

  const territoryRows = await loadTerritoryOverview(payload, user)
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
          votes2022: left.hit.votes2022,
        },
        {
          normalizedName: right.normalizedName,
          votes2022: right.hit.votes2022,
        },
        normalizedQuery,
      ),
    )
    .map((row) => row.hit)

  return {
    status: 'success',
    municipalities: municipalityHits,
    territories: territoryHits,
  }
}
