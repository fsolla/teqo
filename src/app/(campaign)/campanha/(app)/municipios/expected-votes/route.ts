import { NextResponse } from 'next/server'
import { z } from 'zod'

import { municipalityStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffEditMessages'
import { setMunicipalityExpectedVotes } from '@/app/(campaign)/campanha/actions/municipality'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import { MAX_VOTE_COUNT } from '@/lib/schemas/primitives'
import type { MunicipalityListExpectedVotesResponse } from './types'

export type { MunicipalityListExpectedVotesResponse } from './types'

export const dynamic = 'force-dynamic'

const optionalEstimate = z.number().int().min(0).max(MAX_VOTE_COUNT).nullable()

/** Unordered draft body — setMunicipalityExpectedVotes normalizes before persist. */
const bodySchema = z.object({
  municipalityId: positiveRelationshipId,
  expectedVotes: z.object({
    pessimistic: optionalEstimate,
    central: optionalEstimate,
    optimistic: optionalEstimate,
  }),
})

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: municipalityStaffEditSafeMessages,
    genericMessage:
      'Não foi possível salvar os votos estimados. Verifique seu acesso e tente novamente.',
  },
  async ({ municipalityId, expectedVotes }) => {
    const updated = await setMunicipalityExpectedVotes({
      municipality: municipalityId,
      expectedVotes,
    })

    return NextResponse.json<MunicipalityListExpectedVotesResponse>({
      status: 'success',
      message: 'Votos estimados atualizados.',
      savedExpectedVotes: toVoteEstimateScenarioViewModel(updated.expectedVotes),
    })
  },
)
