'use server'

import { revalidatePath } from 'next/cache'

import { declareVotes, estimateVotes } from '@/app/(campaign)/campanha/actions/votePledge'
import {
  nullableFormText,
  requiredIntegerFormValue,
  requiredRelationshipFormValue,
  voteEstimateScenarioFromForm,
} from '@/lib/formData'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const declareSafeMessages = [
  'Somente a coordenação e a assessoria registram votos declarados.',
  'A liderança precisa estar vinculada ao município para registrar votos declarados nele.',
  'Informe a liderança da declaração.',
] as const

export const declareVotesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
    const leadership = requiredRelationshipFormValue(formData, 'leadershipId')
    const declaredVotes = requiredIntegerFormValue(formData, 'declaredVotes', {
      minimum: 0,
      maximum: 1_000_000,
    })

    await declareVotes({ municipality, leadership, declaredVotes })
    revalidatePath('/campanha/municipios/[slug]', 'page')
    return { status: 'success', message: 'Declaração de votos registrada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: declareSafeMessages,
      genericMessage:
        'Não foi possível registrar a declaração. Verifique seu acesso e tente novamente.',
    })
  }
}

export const estimateVotesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const pledge = requiredRelationshipFormValue(formData, 'pledgeId')
    const estimatedVotes = voteEstimateScenarioFromForm(formData, 'estimatedVotes')
    const estimateNote = nullableFormText(formData, 'estimateNote')

    await estimateVotes({
      pledge,
      estimatedVotes,
      estimateNote,
    })
    revalidatePath('/campanha/municipios/[slug]', 'page')
    return { status: 'success', message: 'Estimativa registrada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ['Somente a coordenação e a assessoria registram estimativas.'],
      genericMessage:
        'Não foi possível registrar a estimativa. Verifique seu acesso e tente novamente.',
    })
  }
}
