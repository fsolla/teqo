import { NextResponse } from 'next/server'
import { z } from 'zod'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { setLeadershipMunicipalitiesMembership } from '@/app/(campaign)/campanha/actions/leadership'
import { MAX_LEADERSHIP_MUNICIPALITIES } from '@/lib/schemas/leadership'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { LeadershipListMunicipalitiesResponse } from './types'

export type { LeadershipListMunicipalitiesResponse } from './types'

export const dynamic = 'force-dynamic'

/** Matches `leadershipMunicipalitiesMembershipSchema` exactly. */
const bodySchema = z.object({
  leadershipId: positiveRelationshipId,
  municipalityIds: z
    .array(positiveRelationshipId)
    .min(1)
    .max(MAX_LEADERSHIP_MUNICIPALITIES)
    .transform((ids) => [...new Set(ids)]),
  assigned: z.boolean(),
})

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: leadershipStaffEditSafeMessages,
    genericMessage: 'Não foi possível atualizar os municípios. Tente novamente.',
  },
  async ({ leadershipId, municipalityIds, assigned }) => {
    await setLeadershipMunicipalitiesMembership({
      leadershipId,
      municipalityIds,
      assigned,
    })

    return NextResponse.json<LeadershipListMunicipalitiesResponse>({
      status: 'success',
      message: 'Municípios atualizados.',
    })
  },
)
