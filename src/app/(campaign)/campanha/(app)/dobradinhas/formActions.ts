'use server'

import { setLeadershipStateDeputyMembership } from '@/app/(campaign)/campanha/actions/leadership'
import {
  setStateDeputyAdvisorMembership,
  setStateDeputyMunicipalitiesBatch,
  updateStateDeputyBallotName,
  updateStateDeputyContact,
  updateStateDeputyParty,
} from '@/app/(campaign)/campanha/actions/stateDeputy'
import {
  nullableFormText,
  repeatedPhoneFormValues,
  repeatedRelationshipFormValues,
  requiredFormBoolean,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  LEADERSHIP_STAFF_MESSAGE,
  LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
} from '@/lib/schemas/leadership'
import {
  STATE_DEPUTY_ADVISOR_SAFE_MESSAGES,
  STATE_DEPUTY_CONFLICT_MESSAGE,
  STATE_DEPUTY_INVALID_CONTACT_MESSAGE,
  STATE_DEPUTY_INVALID_FIELD_MESSAGE,
  STATE_DEPUTY_MUNICIPALITIES_SAFE_MESSAGES,
  STATE_DEPUTY_STAFF_MESSAGE,
} from '@/lib/schemas/stateDeputy'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const safeMessages = [LEADERSHIP_STAFF_MESSAGE, LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE] as const

const stateDeputyContactSafeMessages = [
  STATE_DEPUTY_STAFF_MESSAGE,
  STATE_DEPUTY_CONFLICT_MESSAGE,
  STATE_DEPUTY_INVALID_CONTACT_MESSAGE,
] as const

const stateDeputyPartySafeMessages = [STATE_DEPUTY_STAFF_MESSAGE] as const

const stateDeputyBallotNameSafeMessages = [STATE_DEPUTY_STAFF_MESSAGE] as const

/** Per-field Contact edit for B163 (lista + ficha). */
export const updateStateDeputyContactFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const id = requiredRelationshipFormValue(formData, 'stateDeputyId')
      const field = requiredFormText(formData, 'field')

      if (field === 'name') {
        await updateStateDeputyContact({
          id,
          field: 'name',
          name: requiredFormText(formData, 'name'),
        })
      } else if (field === 'email') {
        await updateStateDeputyContact({
          id,
          field: 'email',
          email: nullableFormText(formData, 'email') ?? undefined,
        })
      } else if (field === 'phone') {
        await updateStateDeputyContact({
          id,
          field: 'phone',
          phone: nullableFormText(formData, 'phone'),
        })
      } else if (field === 'phones') {
        await updateStateDeputyContact({
          id,
          field: 'phones',
          phones: repeatedPhoneFormValues(formData, 'phones'),
        })
      } else {
        throw new Error(STATE_DEPUTY_INVALID_FIELD_MESSAGE)
      }

      return { message: 'Salvo.' }
    },
    safeMessages: stateDeputyContactSafeMessages,
    genericMessage: 'Não foi possível salvar. Verifique os dados e tente novamente.',
  })

/** Inline party edit for B163; notes are deliberately left untouched. */
export const updateStateDeputyPartyFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await updateStateDeputyParty({
        id: requiredRelationshipFormValue(formData, 'stateDeputyId'),
        party: nullableFormText(formData, 'party'),
      })
      return { message: 'Salvo.' }
    },
    safeMessages: stateDeputyPartySafeMessages,
    genericMessage: 'Não foi possível salvar o partido. Verifique os dados e tente novamente.',
  })

/** Inline "Nome de legenda" edit for C129 (lista de dobradinhas, B163 machinery). */
export const updateStateDeputyBallotNameFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await updateStateDeputyBallotName({
        id: requiredRelationshipFormValue(formData, 'stateDeputyId'),
        ballotName: nullableFormText(formData, 'ballotName'),
      })
      return { message: 'Salvo.' }
    },
    safeMessages: stateDeputyBallotNameSafeMessages,
    genericMessage:
      'Não foi possível salvar o nome de legenda. Verifique os dados e tente novamente.',
  })

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

/** One chip toggle in the "Assessores" column/section of a dobradinha (B156). */
export const setStateDeputyAdvisorMembershipFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setStateDeputyAdvisorMembership({
        stateDeputyId: requiredRelationshipFormValue(formData, 'stateDeputyId'),
        advisorId: requiredRelationshipFormValue(formData, 'advisorId'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Assessores atualizados.' }
    },
    safeMessages: STATE_DEPUTY_ADVISOR_SAFE_MESSAGES,
    genericMessage: 'Não foi possível atualizar os assessores. Tente novamente.',
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
