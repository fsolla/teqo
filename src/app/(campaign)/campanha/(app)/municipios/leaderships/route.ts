import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  createMunicipalityLeadership,
  setMunicipalityLeadershipMembership,
} from '@/app/(campaign)/campanha/actions/leadership'
import {
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  LEADERSHIP_STAFF_MESSAGE,
  municipalityLeadershipCreateSchema,
} from '@/lib/schemas/leadership'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import { POSTGRES_DEDUP_LOCK_MESSAGE } from '@/utilities/postgresTransactionLocks'

import type { MunicipalityListLeadershipsResponse } from './types'

export type { MunicipalityListLeadershipsResponse } from './types'

export const dynamic = 'force-dynamic'

/**
 * Mutually exclusive shapes (B155/B159): the membership delta (`leadershipId` +
 * `assigned`) and the name-only inline create can never combine — `name` is a
 * write affordance over `leadership.municipalities`, `leadershipId` a delta.
 */
const bodySchema = z.union([
  z.strictObject({
    municipalityId: positiveRelationshipId,
    leadershipId: positiveRelationshipId,
    assigned: z.boolean(),
  }),
  municipalityLeadershipCreateSchema,
])

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: [
      LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
      LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
      LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
      LEADERSHIP_STAFF_MESSAGE,
      LEADERSHIP_DUPLICATE_MESSAGE,
      POSTGRES_DEDUP_LOCK_MESSAGE,
    ],
    genericMessage:
      'Não foi possível atualizar as lideranças. Verifique seu acesso e tente novamente.',
  },
  async (body) => {
    if ('name' in body) {
      const { leadership, leadershipIDs, createdLeadershipName } =
        await createMunicipalityLeadership({
          municipalityId: body.municipalityId,
          name: body.name,
        })

      return NextResponse.json<MunicipalityListLeadershipsResponse>({
        status: 'success',
        message: 'Liderança criada e vinculada.',
        leadershipIDs,
        createdLeadership: {
          id: leadership.id,
          name: createdLeadershipName,
        },
      })
    }

    const { leadershipIDs } = await setMunicipalityLeadershipMembership({
      municipalityId: body.municipalityId,
      leadershipId: body.leadershipId,
      assigned: body.assigned,
    })

    return NextResponse.json<MunicipalityListLeadershipsResponse>({
      status: 'success',
      message: body.assigned ? 'Liderança vinculada.' : 'Liderança removida.',
      leadershipIDs,
    })
  },
)
