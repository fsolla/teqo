'use server'

import {
  createAdvisor,
  sendAdvisorPasswordReset,
  setAdvisorMunicipalitiesBatch,
  setAdvisorMunicipalityMembership,
  updateAdvisorProfile,
} from '@/app/(campaign)/campanha/actions/advisor'
import {
  nullableFormText,
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
const EMPTY_BATCH_MESSAGE = 'Selecione ao menos um município.'

const advisorSafeMessages = [
  ...ADVISOR_ACTION_SAFE_MESSAGES,
  INVALID_FIELD_MESSAGE,
  EMPTY_BATCH_MESSAGE,
] as const

const parseMunicipalityIds = (formData: FormData): number[] => {
  const raw = formData.getAll('municipalityIds')
  const ids = raw
    .map((value) => (typeof value === 'string' ? Number(value) : NaN))
    .filter((id) => Number.isInteger(id) && id > 0)
  return [...new Set(ids)]
}

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

export const setAdvisorMunicipalityMembershipFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setAdvisorMunicipalityMembership({
        advisorId: requiredRelationshipFormValue(formData, 'advisorId'),
        municipalityId: requiredRelationshipFormValue(formData, 'municipalityId'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Carteira atualizada.' }
    },
    safeMessages: advisorSafeMessages,
    genericMessage: 'Não foi possível atualizar a carteira do assessor.',
  })

export const setAdvisorMunicipalitiesBatchFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipalityIds = parseMunicipalityIds(formData)
      if (municipalityIds.length === 0) {
        throw new Error(EMPTY_BATCH_MESSAGE)
      }
      await setAdvisorMunicipalitiesBatch({
        advisorId: requiredRelationshipFormValue(formData, 'advisorId'),
        municipalityIds,
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

      const municipalityIds = parseMunicipalityIds(formData)
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
