import { NextResponse } from 'next/server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { setLeadershipStateDeputyMembership } from '@/app/(campaign)/campanha/actions/leadership'
import {
  LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
  leadershipStateDeputyMembershipSchema,
} from '@/lib/schemas/leadership'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { LeadershipListStateDeputiesResponse } from './types'

export type { LeadershipListStateDeputiesResponse } from './types'

export const dynamic = 'force-dynamic'

export const POST = campaignJsonMutationRoute(
  {
    bodySchema: leadershipStateDeputyMembershipSchema,
    safeMessages: [...leadershipStaffEditSafeMessages, LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE],
    genericMessage: 'Não foi possível atualizar as dobradinhas. Tente novamente.',
  },
  async (body) => {
    await setLeadershipStateDeputyMembership(body)

    return NextResponse.json<LeadershipListStateDeputiesResponse>({
      status: 'success',
      message: 'Dobradinhas atualizadas.',
    })
  },
)
