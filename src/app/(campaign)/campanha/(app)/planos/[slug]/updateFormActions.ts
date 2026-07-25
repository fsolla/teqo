'use server'

import { revalidatePath } from 'next/cache'

import { appendActionPlanUpdate } from '@/app/(campaign)/campanha/actions/actionPlan'
import { requiredFormText, requiredRelationshipFormValue } from '@/lib/formData'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'

export type ActionPlanUpdateFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
}

// The specific validation/transaction messages `appendActionPlanUpdate` throws —
// safe to surface verbatim. Anything else (e.g. an unexpected Payload API error)
// now falls back to the generic message instead of leaking its raw text.
const safeMessages = [
  'Informe o texto da atualização.',
  'Atualização muito longa. Reduza o texto e tente novamente.',
  'Não foi possível registrar a atualização do plano.',
] as const

export const createActionPlanUpdateFormAction = async (
  _state: ActionPlanUpdateFormState,
  formData: FormData,
): Promise<ActionPlanUpdateFormState> => {
  try {
    const planId = requiredRelationshipFormValue(formData, 'planId')
    const body = requiredFormText(formData, 'body')
    await appendActionPlanUpdate(planId, body)
    revalidatePath('/campanha/planos/[slug]', 'page')
    return { status: 'success', message: 'Atualização registrada com sucesso.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages,
      genericMessage:
        'Não foi possível enviar a atualização. Verifique seu acesso e tente novamente.',
    })
  }
}
