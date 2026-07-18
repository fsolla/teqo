'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'

import {
  confirmVoteEstimate,
  suggestVoteEstimate,
} from '@/app/(campaign)/campanha/actions/voteEstimate'
import {
  FormDataBoundaryError,
  optionalFormText,
  requiredIntegerFormValue,
  requiredRelationshipFormValue,
  validationFieldErrors,
} from '@/lib/formData'

export type VoteEstimateFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
}

const errorState = (error: unknown): VoteEstimateFormState => {
  if (error instanceof FormDataBoundaryError) {
    return { fieldErrors: { [error.field]: [error.message] } }
  }
  if (error instanceof ZodError) return { fieldErrors: validationFieldErrors(error) }
  if (
    error instanceof Error &&
    [
      'A liderança precisa de vínculo engajado com este núcleo.',
      'Somente a coordenação pode confirmar estimativas.',
      'A sugestão foi alterada. Atualize a página antes de confirmar.',
      'Informe uma justificativa para ajustar a estimativa.',
    ].includes(error.message)
  ) {
    return { message: error.message }
  }
  return { message: 'Não foi possível salvar a estimativa. Tente novamente.' }
}

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
