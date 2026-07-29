'use server'

// Documented exception to `runCampaignFormAction` (Pass 2 W4d): these actions
// feed message-only inline controls, so every mapped state (field errors
// included) is flattened to a single message via `toMessageOnlyState`.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  removeSupporterData,
  setSupporterVoteIntention,
} from '@/app/(campaign)/campanha/actions/supporter'
import { SUPPORTER_VOTE_INTENTION_CONSENT_MISSING_MESSAGE } from '@/lib/campaignConsentKeys'
import { checkboxFormValue, requiredRelationshipFormValue } from '@/lib/formData'
import type { SupporterVoteIntention } from '@/lib/schemas/supporter'
import {
  SUPPORTER_STAFF_MESSAGE,
  supporterRemoveSchema,
  supporterVoteIntentionSchema,
} from '@/lib/schemas/supporter'
import {
  mapCampaignFormActionError,
  type CampaignFormErrorState,
} from '@/utilities/campaignFormActionError'
import { firstFormActionMessage } from '@/utilities/campaignFormFields'

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
  SUPPORTER_VOTE_INTENTION_CONSENT_MISSING_MESSAGE,
  SUPPORTER_STAFF_MESSAGE,
] as const

const toMessageOnlyState = (mapped: CampaignFormErrorState<unknown>): { message?: string } => {
  const message = firstFormActionMessage(mapped)
  return message ? { message } : {}
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
