'use server'

import { redirect } from 'next/navigation'

import { cancelActivity, markActivityRealized } from '@/app/(campaign)/campanha/actions/activity'
import { requiredRelationshipFormValue } from '@/lib/formData'
import type { Activity } from '@/payload-types'

export type ActivityLifecycleFormState = {
  message?: string
}

const setActivityLifecycleFormAction = async (
  formData: FormData,
  mutate: (activityId: number) => Promise<Pick<Activity, 'slug'>>,
  failureMessage: string,
): Promise<ActivityLifecycleFormState> => {
  let activityId: number
  try {
    activityId = requiredRelationshipFormValue(formData, 'id')
  } catch {
    return {
      message: 'Não foi possível identificar a atividade. Atualize a página e tente novamente.',
    }
  }

  let activitySlug: string
  try {
    const activity = await mutate(activityId)
    activitySlug = activity.slug
  } catch {
    return { message: failureMessage }
  }

  redirect(`/campanha/atividades/${activitySlug}`)
}

export const cancelActivityFormAction = async (
  _state: ActivityLifecycleFormState,
  formData: FormData,
): Promise<ActivityLifecycleFormState> =>
  setActivityLifecycleFormAction(
    formData,
    cancelActivity,
    'Não foi possível cancelar esta atividade. Verifique seu acesso ou atualize a página e tente novamente.',
  )

export const markActivityRealizedFormAction = async (
  _state: ActivityLifecycleFormState,
  formData: FormData,
): Promise<ActivityLifecycleFormState> =>
  setActivityLifecycleFormAction(
    formData,
    markActivityRealized,
    'Não foi possível marcar esta atividade como realizada. Verifique seu acesso ou atualize a página e tente novamente.',
  )
