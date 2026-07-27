import { NextResponse } from 'next/server'
import { z } from 'zod'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { updateLeadershipInternal } from '@/app/(campaign)/campanha/actions/leadership'
import { leadershipSupportStatuses } from '@/lib/schemas/leadership'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import {
  campaignJsonMutationErrorResponse,
  parseCampaignJsonRequestBody,
} from '@/utilities/campaignJsonMutationRoute'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { LeadershipListSupportStatusResponse } from './types'

export type { LeadershipListSupportStatusResponse } from './types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  leadershipId: positiveRelationshipId,
  supportStatus: z.enum(leadershipSupportStatuses),
})

export async function POST(
  request: Request,
): Promise<NextResponse<LeadershipListSupportStatusResponse>> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ status: 'error', message: 'Requisição inválida.' }, { status: 403 })
  }

  const parsed = await parseCampaignJsonRequestBody(request)
  if (!parsed.ok) return parsed.response

  try {
    const { leadershipId, supportStatus } = bodySchema.parse(parsed.body)
    const updated = await updateLeadershipInternal({ id: leadershipId, supportStatus })

    return NextResponse.json({
      status: 'success',
      message: 'Status de apoio atualizado.',
      savedSupportStatus: updated.supportStatus,
    })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: leadershipStaffEditSafeMessages,
      genericMessage: 'Não foi possível salvar o status. Verifique seu acesso e tente novamente.',
    })
  }
}
