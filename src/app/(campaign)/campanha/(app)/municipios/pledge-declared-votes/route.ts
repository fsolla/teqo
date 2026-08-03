import { NextResponse } from 'next/server'
import { z } from 'zod'

import { declareVotes } from '@/app/(campaign)/campanha/actions/votePledge'
import { MAX_VOTE_COUNT, positiveRelationshipId } from '@/lib/schemas/primitives'
import {
  VOTE_PLEDGE_DECLARE_SAFE_MESSAGES,
  VOTE_PLEDGE_LEADERSHIP_REQUIRED_MESSAGE,
  VOTE_PLEDGE_MUNICIPALITY_NOT_LINKED_MESSAGE,
} from '@/lib/schemas/votePledge'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { MunicipalityPledgeDeclaredVotesResponse } from './types'

export type { MunicipalityPledgeDeclaredVotesResponse } from './types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  municipalityId: positiveRelationshipId,
  leadershipId: positiveRelationshipId,
  declaredVotes: z.number().int().min(0).max(MAX_VOTE_COUNT),
})

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: [
      ...VOTE_PLEDGE_DECLARE_SAFE_MESSAGES,
      VOTE_PLEDGE_LEADERSHIP_REQUIRED_MESSAGE,
      VOTE_PLEDGE_MUNICIPALITY_NOT_LINKED_MESSAGE,
    ],
    genericMessage:
      'Não foi possível salvar os votos declarados. Verifique seu acesso e tente novamente.',
  },
  async ({ municipalityId, leadershipId, declaredVotes }) => {
    const pledge = await declareVotes({
      municipality: municipalityId,
      leadership: leadershipId,
      declaredVotes,
    })

    revalidateMunicipalityListPaths({ scope: 'detail' })

    return NextResponse.json<MunicipalityPledgeDeclaredVotesResponse>({
      status: 'success',
      message: 'Votos declarados atualizados.',
      savedDeclaredVotes: pledge.declaredVotes,
      pledgeId: pledge.id,
    })
  },
)
