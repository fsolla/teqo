'use server'

import { revalidatePath } from 'next/cache'

import {
  attachCampaignDemandReceiptRecord,
  setCampaignDemandCost,
  setCampaignDemandResponsibles,
  transitionCampaignDemand,
  updateCampaignDemand,
} from '@/app/(campaign)/campanha/actions/demand'
import {
  FormDataBoundaryError,
  nullableFormText,
  repeatedRelationshipFormValues,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  CAMPAIGN_DEMAND_COST_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_EDIT_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_INVALID_STATUS_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_SAFE_MESSAGES,
  CAMPAIGN_DEMAND_RESPONSIBLES_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_TRANSITION_SAFE_MESSAGES,
  campaignDemandStatuses,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const INVALID_STATUS_MESSAGE = CAMPAIGN_DEMAND_INVALID_STATUS_MESSAGE

const transitionSafeMessages = CAMPAIGN_DEMAND_TRANSITION_SAFE_MESSAGES

export const transitionDemandFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const rawStatus = requiredFormText(formData, 'status')
      if (!campaignDemandStatuses.includes(rawStatus as CampaignDemandStatus)) {
        throw new Error(INVALID_STATUS_MESSAGE)
      }

      await transitionCampaignDemand({
        id: requiredRelationshipFormValue(formData, 'demandId'),
        status: rawStatus as CampaignDemandStatus,
        decisionNote: nullableFormText(formData, 'decisionNote'),
      })
      revalidatePath('/campanha/demandas/[slug]', 'page')
      return { message: 'Demanda atualizada.' }
    },
    safeMessages: transitionSafeMessages,
    genericMessage: 'Não foi possível mover a demanda. Verifique seu acesso e tente novamente.',
  })

export const updateDemandFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await updateCampaignDemand({
        id: requiredRelationshipFormValue(formData, 'demandId'),
        description: requiredFormText(formData, 'description'),
      })
      revalidatePath('/campanha/demandas/[slug]', 'page')
      return { message: 'Descrição atualizada.' }
    },
    safeMessages: [CAMPAIGN_DEMAND_EDIT_STAFF_MESSAGE],
    genericMessage: 'Não foi possível editar a demanda. Tente novamente.',
  })

export const setDemandCostFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const rawCost = formData.get('cost')
      let cost: number | null = null
      if (typeof rawCost === 'string' && rawCost.trim()) {
        const parsed = Number(rawCost.replace(',', '.'))
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new FormDataBoundaryError('cost', 'Informe um valor válido.')
        }
        cost = Math.round(parsed * 100) / 100
      }

      await setCampaignDemandCost({
        id: requiredRelationshipFormValue(formData, 'demandId'),
        cost,
      })
      revalidatePath('/campanha/demandas/[slug]', 'page')
      return { message: 'Custo registrado.' }
    },
    safeMessages: [CAMPAIGN_DEMAND_COST_STAFF_MESSAGE],
    genericMessage: 'Não foi possível registrar o custo. Tente novamente.',
  })

export const setDemandResponsiblesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setCampaignDemandResponsibles({
        id: requiredRelationshipFormValue(formData, 'demandId'),
        responsibles: repeatedRelationshipFormValues(formData, 'responsibles'),
      })
      revalidatePath('/campanha/demandas/[slug]', 'page')
      return { message: 'Responsáveis atualizados.' }
    },
    safeMessages: [CAMPAIGN_DEMAND_RESPONSIBLES_STAFF_MESSAGE],
    genericMessage: 'Não foi possível atualizar os responsáveis. Tente novamente.',
  })

export const attachDemandReceiptFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const demandID = requiredRelationshipFormValue(formData, 'demandId')
      const file = formData.get('receipt')
      if (!(file instanceof File)) {
        throw new FormDataBoundaryError('receipt', 'Selecione um arquivo.')
      }

      const { payload, actor } = await getCampaignActionContext()
      await attachCampaignDemandReceiptRecord(payload, actor, demandID, file)
      revalidatePath('/campanha/demandas/[slug]', 'page')
      return { message: 'Comprovante anexado.' }
    },
    safeMessages: CAMPAIGN_DEMAND_RECEIPT_SAFE_MESSAGES,
    genericMessage: 'Não foi possível anexar o comprovante. Tente novamente.',
  })
