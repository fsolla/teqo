import { NextResponse } from 'next/server'

import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import {
  HOME_SEARCH_GENERIC_ERROR_MESSAGE,
  HOME_SEARCH_STAFF_ONLY_MESSAGE,
} from '@/lib/campaignHomeSearchMessages'
import { homeSearchBodySchema } from '@/lib/schemas/homeSearch'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import { searchHomeMunicipalities } from '@/utilities/homeSearch/searchHomeMunicipalities'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: homeSearchBodySchema,
    safeMessages: [HOME_SEARCH_STAFF_ONLY_MESSAGE],
    genericMessage: HOME_SEARCH_GENERIC_ERROR_MESSAGE,
  },
  async ({ query }) => {
    const { payload, actor } = await getCampaignActionContext()
    const result = await searchHomeMunicipalities(payload, actor, query)
    return NextResponse.json<HomeSearchSuccessResponse>(result)
  },
)
