import { NextResponse } from 'next/server'
import { z } from 'zod'

import { municipalityStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffEditMessages'
import { setMunicipalityExpectedVotes } from '@/app/(campaign)/campanha/actions/municipality'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import {
  CAMPAIGN_SESSION_EXPIRED_MESSAGE,
  mapCampaignFormActionError,
} from '@/utilities/campaignFormActionError'

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

const isSameOriginRequest = (request: Request): boolean => {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<MunicipalityListExpectedVotesResponse>> {
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
    const { municipalityId, expectedVotes } = bodySchema.parse(json)
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
    const mapped = mapCampaignFormActionError({
      error,
      safeMessages: [
        ...municipalityStaffEditSafeMessages,
        'Autenticação necessária.',
        CAMPAIGN_SESSION_EXPIRED_MESSAGE,
      ],
      genericMessage:
        'Não foi possível salvar os votos estimados. Verifique seu acesso e tente novamente.',
    })

    const isAuthError =
      error instanceof Error &&
      (error.message === 'Autenticação necessária.' ||
        error.message === CAMPAIGN_SESSION_EXPIRED_MESSAGE)

    return NextResponse.json(
      {
        status: 'error',
        message: mapped.message ?? 'Não foi possível salvar os votos estimados.',
      },
      { status: isAuthError ? 401 : 400 },
    )
  }
}
