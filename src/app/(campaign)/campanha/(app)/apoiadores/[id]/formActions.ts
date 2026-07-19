'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  removeSupporterData,
  setSupporterVoteIntention,
} from '@/app/(campaign)/campanha/actions/supporter'
import {
  checkboxFormValue,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { supporterRemoveSchema, supporterVoteIntentionSchema } from '@/lib/schemas/supporter'
import type { SupporterVoteIntention } from '@/lib/schemas/supporter'
import {
  mapCampaignFormActionError,
  type CampaignFormErrorState,
} from '@/utilities/campaignFormActionError'

export type SupporterVoteIntentionFormState = {
  status?: 'success'
  message?: string
  voteIntention?: SupporterVoteIntention
}

export type SupporterRemoveFormState = {
  status?: 'success'
  message?: string
}

const safeVoteIntentionMessages = [
  'Consentimento de intenção de voto ainda não configurado.',
  'Somente a coordenação pode gerenciar apoiadores.',
] as const

const toMessageOnlyState = (
  mapped: CampaignFormErrorState<unknown>,
): { message?: string } => {
  if (mapped.message) return { message: mapped.message }
  if (!mapped.fieldErrors) return {}

  const firstFieldMessage = Object.values(mapped.fieldErrors)
    .flat()
    .find((message) => message.length > 0)

  return firstFieldMessage ? { message: firstFieldMessage } : {}
}

export const setSupporterVoteIntentionFormAction = async (
  _state: SupporterVoteIntentionFormState,
  formData: FormData,
): Promise<SupporterVoteIntentionFormState> => {
  try {
    const input = supporterVoteIntentionSchema.parse({
      id: requiredRelationshipFormValue(formData, 'id'),
      voteIntention: formData.get('voteIntention'),
      voteIntentionConsentAccepted: checkboxFormValue(formData, 'voteIntentionConsentAccepted')
        ? true
        : undefined,
    })
    const supporter = await setSupporterVoteIntention(input)
    revalidatePath('/campanha/apoiadores/[id]', 'page')

    return {
      status: 'success',
      message: 'Intenção de voto atualizada.',
      voteIntention: supporter.voteIntention ?? undefined,
    }
  } catch (error) {
    return toMessageOnlyState(
      mapCampaignFormActionError({
        error,
        safeMessages: safeVoteIntentionMessages,
        genericMessage: 'Não foi possível salvar a intenção de voto.',
      }),
    )
  }
}

export const removeSupporterDataFormAction = async (
  _state: SupporterRemoveFormState,
  formData: FormData,
): Promise<SupporterRemoveFormState> => {
  try {
    const input = supporterRemoveSchema.parse({
      id: requiredRelationshipFormValue(formData, 'id'),
    })
    await removeSupporterData(input)
    revalidatePath('/campanha/apoiadores')
    redirect('/campanha/apoiadores')
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error
    return toMessageOnlyState(
      mapCampaignFormActionError({
        error,
        genericMessage: 'Não foi possível remover os dados do apoiador.',
      }),
    )
  }
}
