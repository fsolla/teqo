import { NextResponse } from 'next/server'

import { municipalityStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffEditMessages'
import { setMunicipalityPoliticalTrend } from '@/app/(campaign)/campanha/actions/municipality'
import { municipalityPoliticalTrendSchema } from '@/lib/schemas/municipality'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import {
  campaignJsonMutationErrorResponse,
  parseCampaignJsonRequestBody,
} from '@/utilities/campaignJsonMutationRoute'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { MunicipalityListPoliticalTrendResponse } from './types'

export type { MunicipalityListPoliticalTrendResponse } from './types'

export const dynamic = 'force-dynamic'

/** JSON body uses `municipalityId`; the action schema uses `municipality`. */
const bodySchema = municipalityPoliticalTrendSchema
  .omit({ municipality: true })
  .extend({ municipalityId: positiveRelationshipId })

export async function POST(
  request: Request,
): Promise<NextResponse<MunicipalityListPoliticalTrendResponse>> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ status: 'error', message: 'Requisição inválida.' }, { status: 403 })
  }

  const parsed = await parseCampaignJsonRequestBody(request)
  if (!parsed.ok) return parsed.response

  try {
    const { municipalityId, status, note } = bodySchema.parse(parsed.body)
    const updated = await setMunicipalityPoliticalTrend({
      municipality: municipalityId,
      status,
      note,
    })

    return NextResponse.json({
      status: 'success',
      message: 'Tendência política registrada.',
      savedTrend: {
        status: updated.politicalTrend?.status ?? null,
        note: updated.politicalTrend?.note ?? null,
      },
    })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: municipalityStaffEditSafeMessages,
      genericMessage:
        'Não foi possível salvar a tendência. Verifique seu acesso e tente novamente.',
    })
  }
}
