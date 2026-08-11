'use server'

import {
  createAdvisor,
  sendAdvisorPasswordReset,
  setAdvisorMunicipalitiesBatch,
  updateAdvisorContactFicha,
  updateAdvisorProfile,
} from '@/app/(campaign)/campanha/actions/advisor'
import {
  nullableFormText,
  repeatedPhoneFormValues,
  repeatedRelationshipFormValues,
  requiredFormBoolean,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { ADVISOR_ACTION_SAFE_MESSAGES } from '@/lib/schemas/advisor'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const INVALID_FIELD_MESSAGE = 'Campo inválido.'

const advisorSafeMessages = [...ADVISOR_ACTION_SAFE_MESSAGES, INVALID_FIELD_MESSAGE] as const

export const updateAdvisorProfileFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const id = requiredRelationshipFormValue(formData, 'advisorId')
      const field = requiredFormText(formData, 'field')

      if (field === 'name') {
        await updateAdvisorProfile({ id, name: requiredFormText(formData, 'name') })
      } else if (field === 'email') {
        await updateAdvisorProfile({ id, email: requiredFormText(formData, 'email') })
      } else if (field === 'phone') {
        await updateAdvisorProfile({
          id,
          phone: nullableFormText(formData, 'phone'),
        })
      } else {
        throw new Error(INVALID_FIELD_MESSAGE)
      }

      return { message: 'Salvo.' }
    },
    safeMessages: advisorSafeMessages,
    genericMessage: 'Não foi possível salvar. Verifique os dados e tente novamente.',
  })

/**
 * Add or remove municipalities in the advisor's carteira — one município or a
 * whole território / ZE. `ownerId` is the field name `MunicipalityPortfolioCell`
 * sends, so the same cell serves lideranças and assessores.
 */
export const setAdvisorMunicipalitiesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setAdvisorMunicipalitiesBatch({
        advisorId: requiredRelationshipFormValue(formData, 'ownerId'),
        municipalityIds: repeatedRelationshipFormValues(formData, 'municipalityIds'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Carteira atualizada.' }
    },
    safeMessages: advisorSafeMessages,
    genericMessage: 'Não foi possível atualizar a carteira do assessor.',
  })

export const sendAdvisorPasswordResetFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const result = await sendAdvisorPasswordReset({
        advisorId: requiredRelationshipFormValue(formData, 'advisorId'),
      })
      return { message: `Link de redefinição enviado para ${result.email}.` }
    },
    safeMessages: advisorSafeMessages,
    genericMessage: 'Não foi possível enviar o link de redefinição de senha.',
  })

/**
 * C112 — the advisor's ficha (Contact) phone list. The account keeps its own
 * single channel phone ("Conta"); this editor targets the person's ficha.
 */
export const updateAdvisorContactFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await updateAdvisorContactFicha({
        contactId: requiredRelationshipFormValue(formData, 'contactId'),
        phones: repeatedPhoneFormValues(formData, 'phones'),
      })
      return { message: 'Telefones atualizados.' }
    },
    safeMessages: advisorSafeMessages,
    genericMessage: 'Não foi possível salvar os telefones.',
  })

export const createAdvisorFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState & { advisorId?: number }> =>
  runCampaignFormAction({
    execute: async () => {
      const created = await createAdvisor({
        name: requiredFormText(formData, 'name'),
        email: requiredFormText(formData, 'email'),
        phone: nullableFormText(formData, 'phone') ?? undefined,
      })

      const municipalityIds = repeatedRelationshipFormValues(formData, 'municipalityIds')
      if (municipalityIds.length > 0) {
        await setAdvisorMunicipalitiesBatch({
          advisorId: created.id,
          municipalityIds,
          assigned: true,
        })
      }

      return { message: 'Assessor criado.', advisorId: created.id }
    },
    safeMessages: advisorSafeMessages,
    genericMessage: 'Não foi possível criar o assessor. Verifique os dados e tente novamente.',
  })
