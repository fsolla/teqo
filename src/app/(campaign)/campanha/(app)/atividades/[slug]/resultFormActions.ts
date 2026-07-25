'use server'

import { revalidatePath } from 'next/cache'

import { registerActivityResultAction } from '@/app/(campaign)/campanha/actions/activity'
import { requiredFormText, requiredRelationshipFormValue } from '@/lib/formData'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

// Validation/transaction messages thrown by `registerActivityResult` —
// safe to surface verbatim; anything else falls back to the generic message.
const safeMessages = [
  'Informe o resultado da atividade.',
  'Resultado muito longo. Reduza o texto e tente novamente.',
  'Apenas a equipe da campanha pode registrar o resultado da atividade.',
  'Não foi possível registrar o resultado da atividade.',
] as const

export const registerActivityResultFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const activityId = requiredRelationshipFormValue(formData, 'activityId')
    const resultSummary = requiredFormText(formData, 'resultSummary')
    // Media upload is a follow-up: the v1 form submits text only.
    await registerActivityResultAction(activityId, resultSummary, [])
    revalidatePath('/campanha/atividades/[slug]', 'page')
    return { status: 'success', message: 'Resultado registrado com sucesso.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages,
      genericMessage:
        'Não foi possível registrar o resultado. Verifique seu acesso e tente novamente.',
    })
  }
}
