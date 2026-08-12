'use server'

import {
  setPersonAdvisorMembership,
  setPersonAssessoraMembership,
  setPersonLeadershipMunicipalities,
  setPersonStateDeputyMunicipalities,
  updatePersonContact,
} from '@/app/(campaign)/campanha/actions/person'
import {
  nullableFormText,
  repeatedRelationshipFormValues,
  requiredFormBoolean,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
} from '@/lib/schemas/leadership'
import {
  PERSON_ADVISORS_UNRESTRICTED_MESSAGE,
  PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE,
  PERSON_ASSESSORA_UNRESTRICTED_MESSAGE,
  PERSON_CAPACITY_EXIT_SCOPE_MESSAGE,
  PERSON_CELL_NOT_IN_SCOPE_MESSAGE,
  PERSON_CELL_STAFF_MESSAGE,
  PERSON_CONTACT_INVALID_MESSAGE,
} from '@/lib/schemas/personCell'
import { STATE_DEPUTY_CONFLICT_MESSAGE } from '@/lib/schemas/stateDeputy'
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
  PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE,
] as const

const personAssessoradoSafeMessages = [
  PERSON_ADVISORS_UNRESTRICTED_MESSAGE,
  PERSON_CONTACT_INVALID_MESSAGE,
] as const

const personLeadershipSafeMessages = [
  PERSON_CELL_STAFF_MESSAGE,
  PERSON_CAPACITY_EXIT_SCOPE_MESSAGE,
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
] as const

const personStateDeputySafeMessages = [
  PERSON_CELL_STAFF_MESSAGE,
  PERSON_CAPACITY_EXIT_SCOPE_MESSAGE,
  STATE_DEPUTY_CONFLICT_MESSAGE,
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

/** Lidera column (C128) — person-centric lifecycle: creates/removes the leadership. */
export const setPersonLeadershipMunicipalitiesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setPersonLeadershipMunicipalities({
        contactId: requiredRelationshipFormValue(formData, 'contactId'),
        municipalityIds: repeatedRelationshipFormValues(formData, 'municipalityIds'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Municípios atualizados.' }
    },
    safeMessages: personLeadershipSafeMessages,
    genericMessage: 'Não foi possível atualizar os municípios. Tente novamente.',
  })

/** Dobra em column (C128) — person-centric lifecycle: creates/removes the dobradinha. */
export const setPersonStateDeputyMunicipalitiesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setPersonStateDeputyMunicipalities({
        contactId: requiredRelationshipFormValue(formData, 'contactId'),
        municipalityIds: repeatedRelationshipFormValues(formData, 'municipalityIds'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Municípios atualizados.' }
    },
    safeMessages: personStateDeputySafeMessages,
    genericMessage: 'Não foi possível atualizar os municípios. Tente novamente.',
  })
