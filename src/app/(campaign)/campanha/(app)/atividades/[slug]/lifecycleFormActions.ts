'use server'

import { cancelActivity, markActivityRealized } from '@/app/(campaign)/campanha/actions/activity'
import { FormDataBoundaryError, requiredRelationshipFormValue } from '@/lib/formData'
import type { Activity } from '@/payload-types'
import {
  runCampaignRedirectFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const ACTIVITY_ID_MISSING_MESSAGE =
  'Não foi possível identificar a atividade. Atualize a página e tente novamente.'

// Parse the id before the redirect ladder so a missing/invalid hidden field
// returns `message` (ActivityLifecycleDialog only reads that — not fieldErrors).
const setActivityLifecycleFormAction = async (
  formData: FormData,
  mutate: (activityId: number) => Promise<Pick<Activity, 'slug'>>,
  failureMessage: string,
): Promise<CampaignFormActionState> => {
  let activityId: number
  try {
    activityId = requiredRelationshipFormValue(formData, 'id')
  } catch (error) {
    if (!(error instanceof FormDataBoundaryError)) throw error
    return { message: ACTIVITY_ID_MISSING_MESSAGE }
  }

  return runCampaignRedirectFormAction({
    execute: () => mutate(activityId),
    redirectTo: (activity) => `/campanha/atividades/${activity.slug}`,
    genericMessage: failureMessage,
  })
}

export const cancelActivityFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  setActivityLifecycleFormAction(
    formData,
    cancelActivity,
    'Não foi possível cancelar esta atividade. Verifique seu acesso ou atualize a página e tente novamente.',
  )

export const markActivityRealizedFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  setActivityLifecycleFormAction(
    formData,
    markActivityRealized,
    'Não foi possível marcar esta atividade como realizada. Verifique seu acesso ou atualize a página e tente novamente.',
  )
