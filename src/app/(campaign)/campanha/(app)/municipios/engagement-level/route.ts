import { NextResponse } from 'next/server'

import { setMunicipalityEngagementLevel } from '@/app/(campaign)/campanha/actions/municipality'
import { EngagementLevelBlockedError } from '@/lib/engagementLevel'
import {
  MUNICIPALITY_ENGAGEMENT_LEVEL_UNRESTRICTED_MESSAGE,
  municipalityEngagementLevelSchema,
} from '@/lib/schemas/municipality'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import {
  campaignJsonMutationErrorResponse,
  parseCampaignJsonRequestBody,
} from '@/utilities/campaignJsonMutationRoute'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { MunicipalityListEngagementLevelResponse } from './types'

export type { MunicipalityListEngagementLevelResponse } from './types'

export const dynamic = 'force-dynamic'

/** JSON body uses `municipalityId`; the action schema uses `municipality`. */
const bodySchema = municipalityEngagementLevelSchema
  .omit({ municipality: true })
  .extend({ municipalityId: positiveRelationshipId })

export async function POST(
  request: Request,
): Promise<NextResponse<MunicipalityListEngagementLevelResponse>> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ status: 'error', message: 'Requisição inválida.' }, { status: 403 })
  }

  const parsed = await parseCampaignJsonRequestBody(request)
  if (!parsed.ok) return parsed.response

  try {
    const { municipalityId, ...movement } = bodySchema.parse(parsed.body)
    const updated = await setMunicipalityEngagementLevel({
      municipality: municipalityId,
      ...movement,
    })

    return NextResponse.json({
      status: 'success',
      message: 'Nível de envolvimento registrado.',
      savedLevel: {
        level: movement.level,
        note: updated.levelNote ?? null,
        changedAt: updated.levelChangedAt ?? null,
      },
    })
  } catch (error) {
    if (error instanceof EngagementLevelBlockedError) {
      return NextResponse.json(
        { status: 'blocked', message: error.message, violations: error.violations },
        { status: 409 },
      )
    }

    return campaignJsonMutationErrorResponse(error, {
      // Only the unrestricted-actor message: this action reloads the actor with
      // its own guard, never through `getFreshStaffActor` (same as `advisors/`).
      safeMessages: [MUNICIPALITY_ENGAGEMENT_LEVEL_UNRESTRICTED_MESSAGE],
      genericMessage: 'Não foi possível registrar o nível. Verifique seu acesso e tente novamente.',
    })
  }
}
