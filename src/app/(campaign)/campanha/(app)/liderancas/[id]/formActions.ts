'use server'

import { revalidatePath } from 'next/cache'

import { updateLeadershipInternal } from '@/app/(campaign)/campanha/actions/leadership'
import {
  nullableFormText,
  optionalFormText,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { leadershipSectors, leadershipSupportStatuses } from '@/lib/schemas/leadership'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const safeMessages = [
  'Você só pode vincular lideranças às Praças que assessora.',
  'Somente a coordenação e a assessoria podem gerenciar lideranças.',
] as const

export const updateLeadershipInternalFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const sector = optionalFormText(formData, 'sector')
    const supportStatus = optionalFormText(formData, 'supportStatus')

    await updateLeadershipInternal({
      id: requiredRelationshipFormValue(formData, 'leadershipId'),
      plazas: repeatedRelationshipFormValues(formData, 'plazas'),
      organizations: repeatedRelationshipFormValues(formData, 'organizations'),
      sector: leadershipSectors.includes(sector as (typeof leadershipSectors)[number])
        ? (sector as (typeof leadershipSectors)[number])
        : null,
      supportStatus: leadershipSupportStatuses.includes(
        supportStatus as (typeof leadershipSupportStatuses)[number],
      )
        ? (supportStatus as (typeof leadershipSupportStatuses)[number])
        : undefined,
      notes: nullableFormText(formData, 'notes'),
      consentNote: nullableFormText(formData, 'consentNote'),
    })
    revalidatePath('/campanha/liderancas/[id]', 'page')
    return { status: 'success', message: 'Ficha da liderança atualizada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages,
      genericMessage: 'Não foi possível salvar a ficha. Verifique seu acesso e tente novamente.',
    })
  }
}
