import { NextResponse } from 'next/server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { setLeadershipStateDeputyMembership } from '@/app/(campaign)/campanha/actions/leadership'
import { leadershipStateDeputyMembershipSchema } from '@/lib/schemas/leadership'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { LeadershipListStateDeputiesResponse } from './types'

export type { LeadershipListStateDeputiesResponse } from './types'

export const dynamic = 'force-dynamic'

/** Matches `leadershipStateDeputyMembershipSchema` exactly. */
const bodySchema = leadershipStateDeputyMembershipSchema

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: leadershipStaffEditSafeMessages,
    genericMessage: 'Não foi possível atualizar as dobradinhas. Tente novamente.',
  },
  async ({ leadershipId, stateDeputyId, assigned }) => {
    await setLeadershipStateDeputyMembership({
      leadershipId,
      stateDeputyId,
      assigned,
    })

    return NextResponse.json<LeadershipListStateDeputiesResponse>({
      status: 'success',
      message: assigned ? 'Dobradinha vinculada.' : 'Dobradinha removida.',
    })
  },
)
