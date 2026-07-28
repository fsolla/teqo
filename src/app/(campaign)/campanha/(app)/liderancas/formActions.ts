'use server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import {
  setLeadershipMunicipalitiesMembership,
  setLeadershipStateDeputyMembership,
} from '@/app/(campaign)/campanha/actions/leadership'
import {
  repeatedRelationshipFormValues,
  requiredFormBoolean,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  MAX_LEADERSHIP_STATE_DEPUTIES,
} from '@/lib/schemas/leadership'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const safeMessages = [
  ...leadershipStaffEditSafeMessages,
  `Cada liderança aceita no máximo ${MAX_LEADERSHIP_STATE_DEPUTIES} dobradinhas.`,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
] as const

/** One chip toggle in the "Dobradinhas" column of `/campanha/liderancas` (B31). */
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
      return { message: 'Dobradinhas atualizadas.' }
    },
    safeMessages,
    genericMessage: 'Não foi possível atualizar as dobradinhas. Tente novamente.',
  })

/**
 * Add or remove municipalities in the "Municípios" column of
 * `/campanha/liderancas` (B34) — one chip or a whole território/ZE. `ownerId` is
 * the field name `MunicipalityPortfolioCell` sends, so the same cell serves
 * lideranças and assessores.
 */
export const setLeadershipMunicipalitiesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setLeadershipMunicipalitiesMembership({
        leadershipId: requiredRelationshipFormValue(formData, 'ownerId'),
        municipalityIds: repeatedRelationshipFormValues(formData, 'municipalityIds'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Municípios atualizados.' }
    },
    safeMessages,
    genericMessage: 'Não foi possível atualizar os municípios. Tente novamente.',
  })
