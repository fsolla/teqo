import 'server-only'

import type { Payload } from 'payload'

import {
  toHomeSearchMunicipalityHit,
  type HomeSearchSuccessResponse,
} from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_STAFF_ONLY_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { isStaffCampaignRole, isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import {
  rankHomeSearchSuggestMunicipalities,
  type HomeSearchSuggestMunicipalityInput,
} from '@/lib/homeSearchSuggest'
import type { CampaignUser } from '@/payload-types'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'
import { centralDeficitSortValue } from '@/utilities/municipality/goalCoverage'
import { loadMunicipalityGoalCoverageBundle } from '@/utilities/municipality/municipalityGoalAccount'
import { resolveMunicipalityLastSignalAt } from '@/utilities/municipality/municipalitySignal'

export const loadHomeSearchSuggestions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<HomeSearchSuccessResponse> => {
  if (!isStaffCampaignRole(user.role)) {
    throw new Error(HOME_SEARCH_STAFF_ONLY_MESSAGE)
  }

  const { municipalities, pledgeAggregates } = await loadMunicipalityScope(
    payload,
    user,
    {},
    {
      extraSelect: { lastUpdateAt: true },
    },
  )

  let coverageByMunicipalityID:
    | Awaited<ReturnType<typeof loadMunicipalityGoalCoverageBundle>>['coverageByMunicipalityID']
    | null = null

  if (isUnrestrictedCampaignRole(user.role)) {
    const altaMunicipalities = municipalities.filter(
      (municipality) => municipality.priority === 'alta',
    )
    const bundle = await loadMunicipalityGoalCoverageBundle(
      payload,
      user,
      altaMunicipalities,
      pledgeAggregates,
    )
    coverageByMunicipalityID = bundle.coverageByMunicipalityID
  }

  const inputs: HomeSearchSuggestMunicipalityInput[] = municipalities.map((doc) => {
    const aggregate = pledgeAggregates.get(doc.id)
    const lastSignalAt = resolveMunicipalityLastSignalAt(
      doc.lastUpdateAt ?? null,
      aggregate?.lastPledgeAt ?? null,
    )
    const centralCoverage = coverageByMunicipalityID?.get(doc.id)?.central

    return {
      slug: doc.slug,
      name: doc.name,
      region: doc.region,
      priority: doc.priority ?? null,
      lastSignalAt,
      centralDeficitSortValue: centralDeficitSortValue(centralCoverage),
    }
  })

  const ranked = rankHomeSearchSuggestMunicipalities(user.role, inputs)

  const municipalityHits = ranked.map(toHomeSearchMunicipalityHit)

  return {
    status: 'success',
    resultKind: 'suggest',
    municipalities: municipalityHits,
    territories: [],
    advisors: [],
    leaderships: [],
    stateDeputies: [],
    activities: [],
  }
}
