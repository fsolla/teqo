import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  createMunicipalityLeadership,
  setMunicipalityLeadershipMembership,
} from '@/app/(campaign)/campanha/actions/leadership'
import { BRAZILIAN_PHONE_INVALID_MESSAGE } from '@/lib/phone'
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
import { CONTACT_PHONE_AMBIGUOUS_MESSAGE } from '@/utilities/contactPhoneInvariant'
import { POSTGRES_DEDUP_LOCK_MESSAGE } from '@/utilities/postgresTransactionLocks'

import type { MunicipalityListLeadershipsResponse } from './types'

export type { MunicipalityListLeadershipsResponse } from './types'

export const dynamic = 'force-dynamic'

/**
 * Mutually exclusive shapes (B155): the membership delta (`leadershipId` +
 * `assigned`) and the name+phone inline create can never combine — `name` is a
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
      CONTACT_PHONE_AMBIGUOUS_MESSAGE,
      BRAZILIAN_PHONE_INVALID_MESSAGE,
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
          phone: body.phone,
        })

      return NextResponse.json<MunicipalityListLeadershipsResponse>({
        status: 'success',
        message: 'Liderança criada e vinculada.',
        leadershipIDs,
        // The real contact name, not the typed one: a phone-matched create
        // (`contactReused`) keeps the stored Contact's name.
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
