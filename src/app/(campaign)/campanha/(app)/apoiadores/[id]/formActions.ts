'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ZodError } from 'zod'

import {
  removeSupporterData,
  setSupporterVoteIntention,
} from '@/app/(campaign)/campanha/actions/supporter'
import {
  checkboxFormValue,
  FormDataBoundaryError,
  requiredRelationshipFormValue,
  validationFieldErrors,
} from '@/lib/formData'
import { supporterRemoveSchema, supporterVoteIntentionSchema } from '@/lib/schemas/supporter'
import type { SupporterVoteIntention } from '@/lib/schemas/supporter'

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
    if (error instanceof FormDataBoundaryError) {
      return { message: error.message }
    }
    if (error instanceof ZodError) {
      const fieldErrors = validationFieldErrors(error)
      return { message: fieldErrors.voteIntention?.[0] ?? fieldErrors.form?.[0] }
    }
    if (
      error instanceof Error &&
      safeVoteIntentionMessages.includes(error.message as (typeof safeVoteIntentionMessages)[number])
    ) {
      return { message: error.message }
    }
    return { message: 'Não foi possível salvar a intenção de voto.' }
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
    return { message: 'Não foi possível remover os dados do apoiador.' }
  }
}
