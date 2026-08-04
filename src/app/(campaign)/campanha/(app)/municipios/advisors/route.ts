import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  createMunicipalityAdvisor,
  setMunicipalityAdvisorMembership,
} from '@/app/(campaign)/campanha/actions/municipality'
import { uniqueRelationshipIds } from '@/lib/relationship'
import { MUNICIPALITY_ADVISOR_MEMBERSHIP_SAFE_MESSAGES } from '@/lib/schemas/municipality'
import { advisorNameSchema, positiveRelationshipId } from '@/lib/schemas/primitives'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { MunicipalityListAdvisorsResponse } from './types'

export type { MunicipalityListAdvisorsResponse } from './types'

export const dynamic = 'force-dynamic'

/**
 * Mutually exclusive shapes (B154): the B27 toggle (`advisorId` + `assigned`)
 * and the name-only create (`name`) can never combine — `name` is a write
 * affordance over `municipality.advisors`, `advisorId` a membership delta.
 */
const bodySchema = z.union([
  z.strictObject({
    municipalityId: positiveRelationshipId,
    advisorId: positiveRelationshipId,
    assigned: z.boolean(),
  }),
  z.strictObject({
    municipalityId: positiveRelationshipId,
    name: advisorNameSchema,
  }),
])

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: MUNICIPALITY_ADVISOR_MEMBERSHIP_SAFE_MESSAGES,
    genericMessage:
      'Não foi possível atualizar os assessores. Verifique seu acesso e tente novamente.',
  },
  async (body) => {
    if ('name' in body) {
      const updated = await createMunicipalityAdvisor({
        municipality: body.municipalityId,
        name: body.name,
      })

      return NextResponse.json<MunicipalityListAdvisorsResponse>({
        status: 'success',
        message: 'Assessor criado e atribuído.',
        advisors: uniqueRelationshipIds(updated.advisors),
        createdAdvisor: { id: updated.createdAdvisorId, name: body.name },
      })
    }

    const updated = await setMunicipalityAdvisorMembership({
      municipality: body.municipalityId,
      advisor: body.advisorId,
      assigned: body.assigned,
    })

    return NextResponse.json<MunicipalityListAdvisorsResponse>({
      status: 'success',
      message: body.assigned ? 'Assessor atribuído.' : 'Assessor removido.',
      advisors: uniqueRelationshipIds(updated.advisors),
    })
  },
)
