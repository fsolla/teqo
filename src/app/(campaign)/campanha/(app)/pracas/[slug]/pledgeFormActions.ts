'use server'

import { revalidatePath } from 'next/cache'

import { declareVotes, estimateVotes } from '@/app/(campaign)/campanha/actions/votePledge'
import {
  nullableFormText,
  nullableRelationshipFormValue,
  optionalIntegerFormValue,
  requiredIntegerFormValue,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const declareSafeMessages = [
  'Somente lideranças engajadas podem declarar votos.',
  'A liderança precisa estar vinculada à Praça para declarar votos nela.',
  'Informe a liderança da declaração.',
] as const

export const declareVotesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const plaza = requiredRelationshipFormValue(formData, 'plazaId')
    const leadership = nullableRelationshipFormValue(formData, 'leadershipId') ?? undefined
    const declaredVotes = requiredIntegerFormValue(formData, 'declaredVotes', {
      minimum: 0,
      maximum: 1_000_000,
    })

    await declareVotes({ plaza, leadership, declaredVotes })
    revalidatePath('/campanha/pracas/[slug]', 'page')
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
    const estimatedVotes = optionalIntegerFormValue(formData, 'estimatedVotes', {
      minimum: 0,
      maximum: 1_000_000,
    })
    const estimateNote = nullableFormText(formData, 'estimateNote')

    await estimateVotes({
      pledge,
      estimatedVotes: estimatedVotes ?? null,
      estimateNote,
    })
    revalidatePath('/campanha/pracas/[slug]', 'page')
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
