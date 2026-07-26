import { NextResponse } from 'next/server'
import { z } from 'zod'

import { municipalityStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffEditMessages'
import { setMunicipalityExpectedVotes } from '@/app/(campaign)/campanha/actions/municipality'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import {
  campaignJsonMutationErrorResponse,
  parseCampaignJsonRequestBody,
} from '@/utilities/campaignJsonMutationRoute'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

import type { MunicipalityListExpectedVotesResponse } from './types'

export type { MunicipalityListExpectedVotesResponse } from './types'

export const dynamic = 'force-dynamic'

const optionalEstimate = z.number().int().min(0).max(1_000_000).nullable()

/** Unordered draft body — setMunicipalityExpectedVotes normalizes before persist. */
const bodySchema = z.object({
  municipalityId: positiveRelationshipId,
  expectedVotes: z.object({
    pessimistic: optionalEstimate,
    central: optionalEstimate,
    optimistic: optionalEstimate,
  }),
})

export async function POST(
  request: Request,
): Promise<NextResponse<MunicipalityListExpectedVotesResponse>> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ status: 'error', message: 'Requisição inválida.' }, { status: 403 })
  }

  const parsed = await parseCampaignJsonRequestBody(request)
  if (!parsed.ok) return parsed.response

  try {
    const { municipalityId, expectedVotes } = bodySchema.parse(parsed.body)
    const updated = await setMunicipalityExpectedVotes({
      municipality: municipalityId,
      expectedVotes,
    })

    return NextResponse.json({
      status: 'success',
      message: 'Votos estimados atualizados.',
      savedExpectedVotes: toVoteEstimateScenarioViewModel(updated.expectedVotes),
    })
  } catch (error) {
    return campaignJsonMutationErrorResponse(error, {
      safeMessages: municipalityStaffEditSafeMessages,
      genericMessage:
        'Não foi possível salvar os votos estimados. Verifique seu acesso e tente novamente.',
    })
  }
}
