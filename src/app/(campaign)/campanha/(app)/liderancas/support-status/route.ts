import { NextResponse } from 'next/server'
import { z } from 'zod'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { updateLeadershipInternal } from '@/app/(campaign)/campanha/actions/leadership'
import { leadershipSupportStatuses } from '@/lib/schemas/leadership'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { LeadershipListSupportStatusResponse } from './types'

export type { LeadershipListSupportStatusResponse } from './types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  leadershipId: positiveRelationshipId,
  supportStatus: z.enum(leadershipSupportStatuses),
})

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: leadershipStaffEditSafeMessages,
    genericMessage: 'Não foi possível salvar o status. Verifique seu acesso e tente novamente.',
  },
  async ({ leadershipId, supportStatus }) => {
    const updated = await updateLeadershipInternal({ id: leadershipId, supportStatus })

    return NextResponse.json<LeadershipListSupportStatusResponse>({
      status: 'success',
      message: 'Status de apoio atualizado.',
      savedSupportStatus: updated.supportStatus,
    })
  },
)
