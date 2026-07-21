'use server'

import { revalidatePath } from 'next/cache'

import {
  attachCampaignDemandReceiptRecord,
  setCampaignDemandCost,
  transitionCampaignDemand,
} from '@/app/(campaign)/campanha/actions/demand'
import { nullableFormText, requiredFormText, requiredRelationshipFormValue } from '@/lib/formData'
import { campaignDemandStatuses, type CampaignDemandStatus } from '@/lib/schemas/campaignDemand'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const transitionSafeMessages = [
  'Somente a coordenação e a assessoria movem demandas.',
  'Demandas escaladas são decididas pelo Coordenador Geral.',
] as const

export const transitionDemandFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const rawStatus = requiredFormText(formData, 'status')
    if (!campaignDemandStatuses.includes(rawStatus as CampaignDemandStatus)) {
      return { message: 'Status de demanda inválido.' }
    }

    await transitionCampaignDemand({
      id: requiredRelationshipFormValue(formData, 'demandId'),
      status: rawStatus as CampaignDemandStatus,
      decisionNote: nullableFormText(formData, 'decisionNote'),
    })
    revalidatePath('/campanha/demandas/[slug]', 'page')
    return { status: 'success', message: 'Demanda atualizada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: transitionSafeMessages,
      genericMessage: 'Não foi possível mover a demanda. Verifique seu acesso e tente novamente.',
    })
  }
}

export const setDemandCostFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const rawCost = formData.get('cost')
    let cost: number | null = null
    if (typeof rawCost === 'string' && rawCost.trim()) {
      const parsed = Number(rawCost.replace(',', '.'))
      if (!Number.isFinite(parsed) || parsed < 0) {
        return { fieldErrors: { cost: ['Informe um valor válido.'] } }
      }
      cost = Math.round(parsed * 100) / 100
    }

    await setCampaignDemandCost({
      id: requiredRelationshipFormValue(formData, 'demandId'),
      cost,
    })
    revalidatePath('/campanha/demandas/[slug]', 'page')
    return { status: 'success', message: 'Custo registrado.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ['Somente a coordenação e a assessoria registram custos.'],
      genericMessage: 'Não foi possível registrar o custo. Tente novamente.',
    })
  }
}

export const attachDemandReceiptFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const demandID = requiredRelationshipFormValue(formData, 'demandId')
    const file = formData.get('receipt')
    if (!(file instanceof File)) {
      return { fieldErrors: { receipt: ['Selecione um arquivo.'] } }
    }

    const { payload, actor } = await getCampaignActionContext()
    await attachCampaignDemandReceiptRecord(payload, actor, demandID, file)
    revalidatePath('/campanha/demandas/[slug]', 'page')
    return { status: 'success', message: 'Comprovante anexado.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: [
        'Envie uma imagem (JPEG, PNG, WebP) ou PDF.',
        'O arquivo enviado está vazio.',
        'O comprovante deve ter no máximo 10 MB.',
        'Somente a coordenação e a assessoria anexam comprovantes.',
      ],
      genericMessage: 'Não foi possível anexar o comprovante. Tente novamente.',
    })
  }
}
