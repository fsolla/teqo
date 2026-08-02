'use server'

import { revalidatePath } from 'next/cache'

import {
  attachCampaignDemandReceiptRecord,
  setCampaignDemandCost,
} from '@/app/(campaign)/campanha/actions/demand'
import { FormDataBoundaryError, requiredRelationshipFormValue } from '@/lib/formData'
import {
  CAMPAIGN_DEMAND_COST_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_SAFE_MESSAGES,
} from '@/lib/schemas/campaignDemand'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

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
