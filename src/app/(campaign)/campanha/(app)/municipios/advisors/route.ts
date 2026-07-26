import { NextResponse } from 'next/server'
import { z } from 'zod'

import { setMunicipalityAdvisorMembership } from '@/app/(campaign)/campanha/actions/municipality'
import { MUNICIPALITY_ADVISOR_MEMBERSHIP_SAFE_MESSAGES } from '@/lib/schemas/municipality'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import {
  campaignJsonMutationErrorResponse,
  parseCampaignJsonRequestBody,
} from '@/utilities/campaignJsonMutationRoute'
import { uniqueRelationshipIds } from '@/utilities/relationship'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { MunicipalityListAdvisorsResponse } from './types'

export type { MunicipalityListAdvisorsResponse } from './types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  municipalityId: positiveRelationshipId,
  advisorId: positiveRelationshipId,
  assigned: z.boolean(),
})

export async function POST(
  request: Request,
): Promise<NextResponse<MunicipalityListAdvisorsResponse>> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ status: 'error', message: 'Requisição inválida.' }, { status: 403 })
  }

  const parsed = await parseCampaignJsonRequestBody(request)
  if (!parsed.ok) return parsed.response

  try {
    const { municipalityId, advisorId, assigned } = bodySchema.parse(parsed.body)
    const updated = await setMunicipalityAdvisorMembership({
      municipality: municipalityId,
      advisor: advisorId,
      assigned,
    })

    return NextResponse.json({
      status: 'success',
      message: assigned ? 'Assessor atribuído.' : 'Assessor removido.',
      advisors: uniqueRelationshipIds(updated.advisors),
    })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: MUNICIPALITY_ADVISOR_MEMBERSHIP_SAFE_MESSAGES,
      genericMessage:
        'Não foi possível atualizar os assessores. Verifique seu acesso e tente novamente.',
    })
  }
}
