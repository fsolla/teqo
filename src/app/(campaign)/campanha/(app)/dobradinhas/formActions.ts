'use server'

import { setLeadershipStateDeputyMembership } from '@/app/(campaign)/campanha/actions/leadership'
import { setStateDeputyMunicipalitiesBatch } from '@/app/(campaign)/campanha/actions/stateDeputy'
import {
  repeatedRelationshipFormValues,
  requiredFormBoolean,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE } from '@/lib/schemas/leadership'
import { STATE_DEPUTY_MUNICIPALITIES_SAFE_MESSAGES } from '@/lib/schemas/stateDeputy'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const safeMessages = [
  'Somente a coordenação e a assessoria podem gerenciar lideranças.',
  LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
] as const

/** One chip toggle in the "Lideranças" column of `/campanha/dobradinhas` (B36). */
export const setLeadershipStateDeputyMembershipFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setLeadershipStateDeputyMembership({
        leadershipId: requiredRelationshipFormValue(formData, 'leadershipId'),
        stateDeputyId: requiredRelationshipFormValue(formData, 'stateDeputyId'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Lideranças atualizadas.' }
    },
    safeMessages,
    genericMessage: 'Não foi possível atualizar as lideranças. Tente novamente.',
  })

/**
 * Add or remove municipalities in the "Municípios" column of
 * `/campanha/dobradinhas` (B37) — one chip or a whole território/ZE. `ownerId`
 * is the field name `MunicipalityPortfolioCell` sends, so the same cell
 * serves lideranças, assessores and dobradinhas.
 */
export const setStateDeputyMunicipalitiesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setStateDeputyMunicipalitiesBatch({
        stateDeputyId: requiredRelationshipFormValue(formData, 'ownerId'),
        municipalityIds: repeatedRelationshipFormValues(formData, 'municipalityIds'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Municípios atualizados.' }
    },
    safeMessages: STATE_DEPUTY_MUNICIPALITIES_SAFE_MESSAGES,
    genericMessage: 'Não foi possível atualizar os municípios. Tente novamente.',
  })
