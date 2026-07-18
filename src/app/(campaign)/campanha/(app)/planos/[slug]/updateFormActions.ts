'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'

import { appendActionPlanUpdate } from '@/app/(campaign)/campanha/actions/actionPlan'
import {
  FormDataBoundaryError,
  requiredFormText,
  requiredRelationshipFormValue,
  validationFieldErrors,
} from '@/lib/formData'

export type ActionPlanUpdateFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
}

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
    if (error instanceof FormDataBoundaryError) {
      return { fieldErrors: { [error.field]: [error.message] } }
    }
    if (error instanceof ZodError) {
      return { fieldErrors: validationFieldErrors(error) }
    }
    return {
      message:
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a atualização. Verifique seu acesso e tente novamente.',
    }
  }
}
