import 'server-only'

import type { Payload } from 'payload'

import {
  toHomeSearchMunicipalityHit,
  type WizardMunicipalitySearchSuccessResponse,
} from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_STAFF_ONLY_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { DEFAULT_VOTE_RANK_YEAR, getMunicipalityVoteRank } from '@/lib/municipalityVoteRank'
import {
  rankWizardMunicipalitySuggestions,
  type WizardMunicipalitySuggestInput,
} from '@/lib/wizardMunicipalitySuggest'
import type { CampaignUser } from '@/payload-types'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'
import { resolveMunicipalityLastSignalAt } from '@/utilities/municipality/municipalitySignal'
import { computeMunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'

export const loadWizardMunicipalitySuggestions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<WizardMunicipalitySearchSuccessResponse> => {
  if (!isStaffCampaignRole(user.role)) {
    throw new Error(HOME_SEARCH_STAFF_ONLY_MESSAGE)
  }

  const { municipalities, pledgeAggregates } = await loadMunicipalityScope(
    payload,
    user,
    {},
    {
      extraSelect: {
        lastUpdateAt: true,
        engagementLevel: true,
        politicalTrend: true,
      },
    },
  )

  const inputs: WizardMunicipalitySuggestInput[] = municipalities.map((doc) => {
    const aggregate = pledgeAggregates.get(doc.id)
    const lastSignalAt = resolveMunicipalityLastSignalAt(
      doc.lastUpdateAt ?? null,
      aggregate?.lastPledgeAt ?? null,
    )
    const voteRank = getMunicipalityVoteRank(doc.slug, DEFAULT_VOTE_RANK_YEAR)

    return {
      slug: doc.slug,
      name: doc.name,
      lastSignalAt,
      engagementLevel: doc.engagementLevel ?? null,
      politicalTrend: doc.politicalTrend?.status ?? null,
      territorialClass: computeMunicipalityTerritorialClass(doc.slug).class,
      votes2022: voteRank?.votes ?? null,
    }
  })

  const ranked = rankWizardMunicipalitySuggestions(inputs)

  return {
    status: 'success',
    resultKind: 'wizard-suggest',
    municipalities: ranked.map(toHomeSearchMunicipalityHit),
  }
}
