'use server'

import { revalidatePath } from 'next/cache'

import {
  confirmVoteEstimate,
  suggestVoteEstimate,
} from '@/app/(campaign)/campanha/actions/voteEstimate'
import {
  optionalFormText,
  requiredIntegerFormValue,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'

export type VoteEstimateFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
}

const safeMessages = [
  'A liderança precisa de vínculo engajado com este núcleo.',
  'Somente a coordenação pode confirmar estimativas.',
  'A sugestão foi alterada. Atualize a página antes de confirmar.',
  'Informe uma justificativa para ajustar a estimativa.',
] as const

const errorState = (error: unknown): VoteEstimateFormState =>
  mapCampaignFormActionError({
    error,
    safeMessages,
    genericMessage: 'Não foi possível salvar a estimativa. Tente novamente.',
  })

export const suggestVoteEstimateFormAction = async (
  _state: VoteEstimateFormState,
  formData: FormData,
): Promise<VoteEstimateFormState> => {
  try {
    const updated = await suggestVoteEstimate({
      nucleus: requiredRelationshipFormValue(formData, 'nucleus'),
      estimate: requiredIntegerFormValue(formData, 'estimate', {
        maximum: 100_000_000,
      }),
    })
    revalidatePath(`/campanha/nucleos/${updated.slug}`)
    return { status: 'success', message: 'Sugestão enviada para revisão.' }
  } catch (error) {
    return errorState(error)
  }
}

export const confirmVoteEstimateFormAction = async (
  expectedProposedVoteEstimateVersion: string | null,
  _state: VoteEstimateFormState,
  formData: FormData,
): Promise<VoteEstimateFormState> => {
  try {
    const updated = await confirmVoteEstimate({
      nucleus: requiredRelationshipFormValue(formData, 'nucleus'),
      estimate: requiredIntegerFormValue(formData, 'estimate', {
        maximum: 100_000_000,
      }),
      expectedProposedVoteEstimateVersion,
      confirmationNote: optionalFormText(formData, 'confirmationNote'),
    })
    revalidatePath(`/campanha/nucleos/${updated.slug}`)
    return { status: 'success', message: 'Estimativa confirmada.' }
  } catch (error) {
    return errorState(error)
  }
}
