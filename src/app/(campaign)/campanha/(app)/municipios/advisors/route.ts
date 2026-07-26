import { NextResponse } from 'next/server'
import { z } from 'zod'

import { setMunicipalityAdvisorMembership } from '@/app/(campaign)/campanha/actions/municipality'
import { MUNICIPALITY_ADVISOR_MEMBERSHIP_SAFE_MESSAGES } from '@/lib/schemas/municipality'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import {
  CAMPAIGN_SESSION_EXPIRED_MESSAGE,
  mapCampaignFormActionError,
} from '@/utilities/campaignFormActionError'
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

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Corpo da requisição inválido.' },
      { status: 400 },
    )
  }

  try {
    const { municipalityId, advisorId, assigned } = bodySchema.parse(json)
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
    const mapped = mapCampaignFormActionError({
      error,
      safeMessages: [
        ...MUNICIPALITY_ADVISOR_MEMBERSHIP_SAFE_MESSAGES,
        'Autenticação necessária.',
        CAMPAIGN_SESSION_EXPIRED_MESSAGE,
      ],
      genericMessage:
        'Não foi possível atualizar os assessores. Verifique seu acesso e tente novamente.',
    })

    const isAuthError =
      error instanceof Error &&
      (error.message === 'Autenticação necessária.' ||
        error.message === CAMPAIGN_SESSION_EXPIRED_MESSAGE)

    return NextResponse.json(
      {
        status: 'error',
        message: mapped.message ?? 'Não foi possível atualizar os assessores.',
      },
      { status: isAuthError ? 401 : 400 },
    )
  }
}
