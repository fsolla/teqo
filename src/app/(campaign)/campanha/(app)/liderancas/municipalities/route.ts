import { NextResponse } from 'next/server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { setLeadershipMunicipalitiesMembership } from '@/app/(campaign)/campanha/actions/leadership'
import {
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  leadershipMunicipalitiesMembershipSchema,
} from '@/lib/schemas/leadership'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { LeadershipListMunicipalitiesResponse } from './types'

export type { LeadershipListMunicipalitiesResponse } from './types'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: leadershipMunicipalitiesMembershipSchema,
    safeMessages: [
      ...leadershipStaffEditSafeMessages,
      LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
      LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
      LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
    ],
    genericMessage: 'Não foi possível atualizar os municípios. Tente novamente.',
  },
  async (body) => {
    await setLeadershipMunicipalitiesMembership(body)

    return NextResponse.json<LeadershipListMunicipalitiesResponse>({
      status: 'success',
      message: 'Municípios atualizados.',
    })
  },
)
