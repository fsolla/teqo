import { NextResponse } from 'next/server'
import { z } from 'zod'

import { setMunicipalityAdvisorMembership } from '@/app/(campaign)/campanha/actions/municipality'
import { uniqueRelationshipIds } from '@/lib/relationship'
import { MUNICIPALITY_ADVISOR_MEMBERSHIP_SAFE_MESSAGES } from '@/lib/schemas/municipality'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { MunicipalityListAdvisorsResponse } from './types'

export type { MunicipalityListAdvisorsResponse } from './types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  municipalityId: positiveRelationshipId,
  advisorId: positiveRelationshipId,
  assigned: z.boolean(),
})

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: MUNICIPALITY_ADVISOR_MEMBERSHIP_SAFE_MESSAGES,
    genericMessage:
      'Não foi possível atualizar os assessores. Verifique seu acesso e tente novamente.',
  },
  async ({ municipalityId, advisorId, assigned }) => {
    const updated = await setMunicipalityAdvisorMembership({
      municipality: municipalityId,
      advisor: advisorId,
      assigned,
    })

    return NextResponse.json<MunicipalityListAdvisorsResponse>({
      status: 'success',
      message: assigned ? 'Assessor atribuído.' : 'Assessor removido.',
      advisors: uniqueRelationshipIds(updated.advisors),
    })
  },
)
