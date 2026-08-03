import { NextResponse } from 'next/server'
import { z } from 'zod'

import { estimateVotes } from '@/app/(campaign)/campanha/actions/votePledge'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import {
  VOTE_PLEDGE_ESTIMATE_STAFF_MESSAGE,
  voteEstimateScenarioFieldsSchema,
} from '@/lib/schemas/votePledge'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'

import type { MunicipalityPledgeEstimatedVotesResponse } from './types'

export type { MunicipalityPledgeEstimatedVotesResponse } from './types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  pledgeId: positiveRelationshipId,
  estimatedVotes: voteEstimateScenarioFieldsSchema,
})

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: [VOTE_PLEDGE_ESTIMATE_STAFF_MESSAGE],
    genericMessage: 'Não foi possível salvar a estimativa. Verifique seu acesso e tente novamente.',
  },
  async ({ pledgeId, estimatedVotes }) => {
    const pledge = await estimateVotes({
      pledge: pledgeId,
      estimatedVotes,
      estimateNote: null,
    })

    revalidateMunicipalityListPaths({ scope: 'detail' })

    return NextResponse.json<MunicipalityPledgeEstimatedVotesResponse>({
      status: 'success',
      message: 'Estimativa atualizada.',
      savedEstimatedVotes: toVoteEstimateScenarioViewModel(pledge.estimatedVotes),
    })
  },
)
