import { NextResponse } from 'next/server'

import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import {
  HOME_SEARCH_GENERIC_ERROR_MESSAGE,
  HOME_SEARCH_STAFF_ONLY_MESSAGE,
} from '@/lib/campaignHomeSearchMessages'
import { homeSearchBodySchema } from '@/lib/schemas/homeSearch'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import { loadHomeSearchSuggestions } from '@/utilities/homeSearch/loadHomeSearchSuggestions'
import { searchHomeAdvisors } from '@/utilities/homeSearch/searchHomeAdvisors'
import { searchHomeMunicipalities } from '@/utilities/homeSearch/searchHomeMunicipalities'

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

    const [municipalityResult, advisors] = await Promise.all([
      searchHomeMunicipalities(payload, actor, body.query),
      searchHomeAdvisors(payload, actor, body.query),
    ])
    return NextResponse.json<HomeSearchSuccessResponse>({ ...municipalityResult, advisors })
  },
)
