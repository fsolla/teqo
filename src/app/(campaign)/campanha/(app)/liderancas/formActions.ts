'use server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import {
  setLeadershipMunicipalitiesMembership,
  setLeadershipStateDeputyMembership,
  updateLeadershipContact,
} from '@/app/(campaign)/campanha/actions/leadership'
import {
  nullableFormText,
  repeatedPhoneFormValues,
  repeatedRelationshipFormValues,
  requiredFormBoolean,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  LEADERSHIP_INVALID_CONTACT_MESSAGE,
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
} from '@/lib/schemas/leadership'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const INVALID_FIELD_MESSAGE = 'Campo inválido.'

const safeMessages = [
  ...leadershipStaffEditSafeMessages,
  LEADERSHIP_INVALID_CONTACT_MESSAGE,
  LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  INVALID_FIELD_MESSAGE,
] as const

/** Per-field Contact edit for B153 (lista + detalhe). */
export const updateLeadershipContactFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const id = requiredRelationshipFormValue(formData, 'leadershipId')
      const field = requiredFormText(formData, 'field')

      if (field === 'name') {
        await updateLeadershipContact({
          id,
          field: 'name',
          name: requiredFormText(formData, 'name'),
        })
      } else if (field === 'email') {
        await updateLeadershipContact({
          id,
          field: 'email',
          email: nullableFormText(formData, 'email') ?? undefined,
        })
      } else if (field === 'phone') {
        await updateLeadershipContact({
          id,
          field: 'phone',
          phone: nullableFormText(formData, 'phone'),
        })
      } else if (field === 'phones') {
        await updateLeadershipContact({
          id,
          field: 'phones',
          phones: repeatedPhoneFormValues(formData, 'phones'),
        })
      } else {
        throw new Error(INVALID_FIELD_MESSAGE)
      }

      return { message: 'Salvo.' }
    },
    safeMessages,
    genericMessage: 'Não foi possível salvar. Verifique os dados e tente novamente.',
  })

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
