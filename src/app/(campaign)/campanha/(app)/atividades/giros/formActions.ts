'use server'

import { createTourDraftActivities } from '@/app/(campaign)/campanha/actions/activity'
import { parseTourDraftFormData } from '@/utilities/activityFormData'
import { buildActivityListHref } from '@/utilities/activityUi'
import {
  runCampaignRedirectFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import {
  TOUR_EMPTY_MESSAGE,
  TOUR_MAX_STOPS_MESSAGE,
  TOUR_OUT_OF_SCOPE_MESSAGE,
  TOUR_STAFF_ONLY_MESSAGE,
} from '@/utilities/visit/visitPlannerViews'

const TOUR_SAFE_MESSAGES = [
  TOUR_EMPTY_MESSAGE,
  TOUR_MAX_STOPS_MESSAGE,
  TOUR_OUT_OF_SCOPE_MESSAGE,
  TOUR_STAFF_ONLY_MESSAGE,
] as const

/**
 * Success lands on the Atividades list filtered to drafts: the giro only exists
 * as its stops, so the place where the coordination edits and schedules them is
 * the honest destination — not a confirmation screen with nothing to do on it.
 */
export const createTourDraftsFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignRedirectFormAction({
    execute: async () => createTourDraftActivities(parseTourDraftFormData(formData)),
    redirectTo: () => buildActivityListHref({ page: 1, tab: 'rascunhos' }, 1),
    safeMessages: TOUR_SAFE_MESSAGES,
    genericMessage:
      'Não foi possível gerar os rascunhos do giro. Verifique se algum título já existe e tente novamente.',
  })
