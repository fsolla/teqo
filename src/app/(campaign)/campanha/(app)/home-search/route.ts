import { NextResponse } from 'next/server'

import type {
  HomeSearchSuccessResponse,
  WizardMunicipalitySearchSuccessResponse,
} from '@/lib/campaignHomeSearchHits'
import {
  HOME_SEARCH_GENERIC_ERROR_MESSAGE,
  HOME_SEARCH_STAFF_ONLY_MESSAGE,
} from '@/lib/campaignHomeSearchMessages'
import { homeSearchBodySchema } from '@/lib/schemas/homeSearch'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import { loadHomeSearchSuggestions } from '@/utilities/homeSearch/loadHomeSearchSuggestions'
import { searchHomeActivities } from '@/utilities/homeSearch/searchHomeActivities'
import { searchHomeAdvisors } from '@/utilities/homeSearch/searchHomeAdvisors'
import { searchHomeLeaderships } from '@/utilities/homeSearch/searchHomeLeaderships'
import { searchHomeMunicipalities } from '@/utilities/homeSearch/searchHomeMunicipalities'
import { searchHomeStateDeputies } from '@/utilities/homeSearch/searchHomeStateDeputies'
import { searchStaffMunicipalityHits } from '@/utilities/homeSearch/searchStaffMunicipalityHits'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: homeSearchBodySchema,
    safeMessages: [HOME_SEARCH_STAFF_ONLY_MESSAGE],
    genericMessage: HOME_SEARCH_GENERIC_ERROR_MESSAGE,
  },
  async (body) => {
    const { payload, actor } = await getCampaignActionContext()

    if (body.mode === 'suggest') {
      const result = await loadHomeSearchSuggestions(payload, actor)
      return NextResponse.json<HomeSearchSuccessResponse>(result)
    }

    if (body.mode === 'wizard-municipality') {
      const municipalities = await searchStaffMunicipalityHits(payload, actor, body.query)
      return NextResponse.json<WizardMunicipalitySearchSuccessResponse>({
        status: 'success',
        municipalities,
      })
    }

    const [municipalityResult, advisors, leaderships, activities, stateDeputies] =
      await Promise.all([
        searchHomeMunicipalities(payload, actor, body.query),
        searchHomeAdvisors(payload, actor, body.query),
        searchHomeLeaderships(payload, actor, body.query),
        searchHomeActivities(payload, actor, body.query),
        searchHomeStateDeputies(payload, actor, body.query),
      ])
    return NextResponse.json<HomeSearchSuccessResponse>({
      ...municipalityResult,
      advisors,
      leaderships,
      activities,
      stateDeputies,
    })
  },
)
