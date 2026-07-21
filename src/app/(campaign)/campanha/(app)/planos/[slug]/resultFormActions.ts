'use server'

import { revalidatePath } from 'next/cache'

import { registerActionPlanResultAction } from '@/app/(campaign)/campanha/actions/actionPlan'
import { requiredFormText, requiredRelationshipFormValue } from '@/lib/formData'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

// Validation/transaction messages thrown by `registerActionPlanResult` —
// safe to surface verbatim; anything else falls back to the generic message.
const safeMessages = [
  'Informe o resultado da ação.',
  'Resultado muito longo. Reduza o texto e tente novamente.',
  'Apenas a equipe da campanha pode registrar o resultado do plano.',
  'Não foi possível registrar o resultado do plano.',
] as const

export const registerActionPlanResultFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const planId = requiredRelationshipFormValue(formData, 'planId')
    const resultSummary = requiredFormText(formData, 'resultSummary')
    // Media upload is a follow-up: the v1 form submits text only.
    await registerActionPlanResultAction(planId, resultSummary, [])
    revalidatePath('/campanha/planos/[slug]', 'page')
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
