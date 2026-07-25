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
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { ADVISOR_ACTION_SAFE_MESSAGES } from '@/lib/schemas/advisor'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

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
): Promise<CampaignFormActionState> => {
  try {
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
      return { message: 'Campo inválido.' }
    }

    return { status: 'success', message: 'Salvo.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ADVISOR_ACTION_SAFE_MESSAGES,
      genericMessage: 'Não foi possível salvar. Verifique os dados e tente novamente.',
    })
  }
}

export const setAdvisorMunicipalityMembershipFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const assignedRaw = requiredFormText(formData, 'assigned')
    await setAdvisorMunicipalityMembership({
      advisorId: requiredRelationshipFormValue(formData, 'advisorId'),
      municipalityId: requiredRelationshipFormValue(formData, 'municipalityId'),
      assigned: assignedRaw === 'true',
    })
    return { status: 'success', message: 'Carteira atualizada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ADVISOR_ACTION_SAFE_MESSAGES,
      genericMessage: 'Não foi possível atualizar a carteira do assessor.',
    })
  }
}

export const setAdvisorMunicipalitiesBatchFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const municipalityIds = parseMunicipalityIds(formData)
    if (municipalityIds.length === 0) {
      return { message: 'Selecione ao menos um município.' }
    }
    const assignedRaw = requiredFormText(formData, 'assigned')
    await setAdvisorMunicipalitiesBatch({
      advisorId: requiredRelationshipFormValue(formData, 'advisorId'),
      municipalityIds,
      assigned: assignedRaw === 'true',
    })
    return { status: 'success', message: 'Carteira atualizada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ADVISOR_ACTION_SAFE_MESSAGES,
      genericMessage: 'Não foi possível atualizar a carteira do assessor.',
    })
  }
}

export const sendAdvisorPasswordResetFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const result = await sendAdvisorPasswordReset({
      advisorId: requiredRelationshipFormValue(formData, 'advisorId'),
    })
    return {
      status: 'success',
      message: `Link de redefinição enviado para ${result.email}.`,
    }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ADVISOR_ACTION_SAFE_MESSAGES,
      genericMessage: 'Não foi possível enviar o link de redefinição de senha.',
    })
  }
}

export const createAdvisorFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState & { advisorId?: number }> => {
  try {
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

    return {
      status: 'success',
      message: 'Assessor criado.',
      advisorId: created.id,
    }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ADVISOR_ACTION_SAFE_MESSAGES,
      genericMessage: 'Não foi possível criar o assessor. Verifique os dados e tente novamente.',
    })
  }
}
