'use server'

import { setLeadershipMunicipalitiesMembership } from '@/app/(campaign)/campanha/actions/leadership'
import {
  setPersonAdvisorMembership,
  setPersonAssessoraMembership,
  updatePersonContact,
} from '@/app/(campaign)/campanha/actions/person'
import { setStateDeputyMunicipalitiesBatch } from '@/app/(campaign)/campanha/actions/stateDeputy'
import {
  nullableFormText,
  repeatedRelationshipFormValues,
  requiredFormBoolean,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  LEADERSHIP_STAFF_MESSAGE,
} from '@/lib/schemas/leadership'
import {
  PERSON_ADVISORS_UNRESTRICTED_MESSAGE,
  PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE,
  PERSON_ASSESSORA_NO_ACCOUNT_MESSAGE,
  PERSON_ASSESSORA_UNRESTRICTED_MESSAGE,
  PERSON_CELL_NOT_IN_SCOPE_MESSAGE,
  PERSON_CELL_STAFF_MESSAGE,
  PERSON_CONTACT_INVALID_MESSAGE,
} from '@/lib/schemas/personCell'
import {
  STATE_DEPUTY_MUNICIPALITIES_SAFE_MESSAGES,
  STATE_DEPUTY_STAFF_MESSAGE,
} from '@/lib/schemas/stateDeputy'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const personContactSafeMessages = [
  PERSON_CELL_STAFF_MESSAGE,
  PERSON_CELL_NOT_IN_SCOPE_MESSAGE,
  PERSON_CONTACT_INVALID_MESSAGE,
] as const

const personAssessoraSafeMessages = [
  PERSON_ASSESSORA_UNRESTRICTED_MESSAGE,
  PERSON_ASSESSORA_NO_ACCOUNT_MESSAGE,
  PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE,
] as const

const personAssessoradoSafeMessages = [
  PERSON_ADVISORS_UNRESTRICTED_MESSAGE,
  PERSON_CONTACT_INVALID_MESSAGE,
] as const

const leadershipMunicipalitiesSafeMessages = [
  LEADERSHIP_STAFF_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
] as const

/** Per-field Contact edit for the people list cells (C116). */
export const updatePersonContactFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const contactId = requiredRelationshipFormValue(formData, 'contactId')
      const field = requiredFormText(formData, 'field')

      if (field === 'name') {
        await updatePersonContact({
          id: contactId,
          field: 'name',
          name: requiredFormText(formData, 'name'),
        })
      } else if (field === 'email') {
        await updatePersonContact({
          id: contactId,
          field: 'email',
          email: nullableFormText(formData, 'email') ?? undefined,
        })
      } else if (field === 'phone') {
        await updatePersonContact({
          id: contactId,
          field: 'phone',
          phone: nullableFormText(formData, 'phone'),
        })
      } else if (field === 'city') {
        await updatePersonContact({
          id: contactId,
          field: 'city',
          city: requiredFormText(formData, 'city'),
        })
      } else {
        throw new Error(PERSON_CELL_NOT_IN_SCOPE_MESSAGE)
      }

      return { message: 'Salvo.' }
    },
    safeMessages: personContactSafeMessages,
    genericMessage: 'Não foi possível salvar. Verifique os dados e tente novamente.',
  })

/**
 * Assessora column (C116): one territory / "Salvador (19)" batch or single
 * municipality toggling the person's staff account on `municipality.advisors`.
 */
export const setPersonAssessoraFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setPersonAssessoraMembership({
        contactId: requiredRelationshipFormValue(formData, 'contactId'),
        municipalityIds: repeatedRelationshipFormValues(formData, 'municipalityIds'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Carteira atualizada.' }
    },
    safeMessages: personAssessoraSafeMessages,
    genericMessage: 'Não foi possível atualizar a carteira. Tente novamente.',
  })

/**
 * Assessorado column (C116): one advisor delta applied to every entity of the
 * person (leadership and/or dobradinha).
 */
export const setPersonAssessoradoFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setPersonAdvisorMembership({
        contactId: requiredRelationshipFormValue(formData, 'contactId'),
        advisorId: requiredRelationshipFormValue(formData, 'advisorId'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Assessores atualizados.' }
    },
    safeMessages: personAssessoradoSafeMessages,
    genericMessage: 'Não foi possível atualizar os assessores. Tente novamente.',
  })

/** Lidera column (C116) — reuses the leadership municipalities write. */
export const setPersonLeadershipMunicipalitiesFormAction = async (
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
    safeMessages: leadershipMunicipalitiesSafeMessages,
    genericMessage: 'Não foi possível atualizar os municípios. Tente novamente.',
  })

/** Aliada em column (C116) — reuses the dobradinha municipalities write. */
export const setPersonStateDeputyMunicipalitiesFormAction = async (
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
    safeMessages: [
      ...STATE_DEPUTY_MUNICIPALITIES_SAFE_MESSAGES,
      STATE_DEPUTY_STAFF_MESSAGE,
    ] as const,
    genericMessage: 'Não foi possível atualizar os municípios. Tente novamente.',
  })
