'use server'

import { revalidatePath } from 'next/cache'

import { MAX_VOTE_COUNT } from '@/lib/schemas/primitives'

import { declareVotes, estimateVotes } from '@/app/(campaign)/campanha/actions/votePledge'
import {
  nullableFormText,
  requiredIntegerFormValue,
  requiredRelationshipFormValue,
  voteEstimateScenarioFromForm,
} from '@/lib/formData'
import {
  VOTE_PLEDGE_DECLARE_SAFE_MESSAGES,
  VOTE_PLEDGE_ESTIMATE_SAFE_MESSAGES,
} from '@/lib/schemas/votePledge'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const declareSafeMessages = VOTE_PLEDGE_DECLARE_SAFE_MESSAGES

export const declareVotesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
      const leadership = requiredRelationshipFormValue(formData, 'leadershipId')
      const declaredVotes = requiredIntegerFormValue(formData, 'declaredVotes', {
        minimum: 0,
        maximum: MAX_VOTE_COUNT,
      })

      await declareVotes({ municipality, leadership, declaredVotes })
      revalidatePath('/campanha/municipios/[slug]', 'page')
      return { message: 'Declaração de votos registrada.' }
    },
    safeMessages: declareSafeMessages,
    genericMessage:
      'Não foi possível registrar a declaração. Verifique seu acesso e tente novamente.',
  })

export const estimateVotesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const pledge = requiredRelationshipFormValue(formData, 'pledgeId')
      const estimatedVotes = voteEstimateScenarioFromForm(formData, 'estimatedVotes')
      const estimateNote = nullableFormText(formData, 'estimateNote')

      await estimateVotes({
        pledge,
        estimatedVotes,
        estimateNote,
      })
      revalidatePath('/campanha/municipios/[slug]', 'page')
      return { message: 'Estimativa registrada.' }
    },
    safeMessages: VOTE_PLEDGE_ESTIMATE_SAFE_MESSAGES,
    genericMessage:
      'Não foi possível registrar a estimativa. Verifique seu acesso e tente novamente.',
  })
