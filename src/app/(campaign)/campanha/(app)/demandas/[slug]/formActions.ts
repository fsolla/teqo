'use server'

import { revalidatePath } from 'next/cache'

import {
  attachCampaignDemandReceiptRecord,
  setCampaignDemandCost,
  transitionCampaignDemand,
} from '@/app/(campaign)/campanha/actions/demand'
import {
  FormDataBoundaryError,
  nullableFormText,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { campaignDemandStatuses, type CampaignDemandStatus } from '@/lib/schemas/campaignDemand'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const INVALID_STATUS_MESSAGE = 'Status de demanda inválido.'

const transitionSafeMessages = [
  'Somente a coordenação e a assessoria movem demandas.',
  'Demandas escaladas são decididas pelo Coordenador Geral.',
  INVALID_STATUS_MESSAGE,
] as const

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
    safeMessages: ['Somente a coordenação e a assessoria registram custos.'],
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
    safeMessages: [
      'Envie uma imagem (JPEG, PNG, WebP) ou PDF.',
      'O arquivo enviado está vazio.',
      'O comprovante deve ter no máximo 10 MB.',
      'Somente a coordenação e a assessoria anexam comprovantes.',
    ],
    genericMessage: 'Não foi possível anexar o comprovante. Tente novamente.',
  })
