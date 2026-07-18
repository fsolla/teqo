'use server'

import { redirect } from 'next/navigation'

import {
  cancelActionPlan,
  markActionPlanRealized,
} from '@/app/(campaign)/campanha/actions/actionPlan'
import { requiredRelationshipFormValue } from '@/lib/formData'
import type { ActionPlan } from '@/payload-types'

export type ActionPlanLifecycleFormState = {
  message?: string
}

const setActionPlanLifecycleFormAction = async (
  formData: FormData,
  mutate: (planId: number) => Promise<Pick<ActionPlan, 'slug'>>,
  failureMessage: string,
): Promise<ActionPlanLifecycleFormState> => {
  let planId: number
  try {
    planId = requiredRelationshipFormValue(formData, 'id')
  } catch {
    return {
      message: 'Não foi possível identificar o plano. Atualize a página e tente novamente.',
    }
  }

  let planSlug: string
  try {
    const plan = await mutate(planId)
    planSlug = plan.slug
  } catch {
    return { message: failureMessage }
  }

  redirect(`/campanha/planos/${planSlug}`)
}

export const cancelActionPlanFormAction = async (
  _state: ActionPlanLifecycleFormState,
  formData: FormData,
): Promise<ActionPlanLifecycleFormState> =>
  setActionPlanLifecycleFormAction(
    formData,
    cancelActionPlan,
    'Não foi possível cancelar este plano. Verifique seu acesso ou atualize a página e tente novamente.',
  )

export const markActionPlanRealizedFormAction = async (
  _state: ActionPlanLifecycleFormState,
  formData: FormData,
): Promise<ActionPlanLifecycleFormState> =>
  setActionPlanLifecycleFormAction(
    formData,
    markActionPlanRealized,
    'Não foi possível marcar este plano como realizado. Verifique seu acesso ou atualize a página e tente novamente.',
  )
