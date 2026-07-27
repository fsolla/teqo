'use server'

import { revalidatePath } from 'next/cache'

import { appendActivityUpdate } from '@/app/(campaign)/campanha/actions/activity'
import { requiredFormText, requiredRelationshipFormValue } from '@/lib/formData'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

// The specific validation/transaction messages `appendActivityUpdate` throws —
// safe to surface verbatim. Anything else (e.g. an unexpected Payload API error)
// now falls back to the generic message instead of leaking its raw text.
const safeMessages = [
  'Informe o texto da atualização.',
  'Atualização muito longa. Reduza o texto e tente novamente.',
  'Não foi possível registrar a atualização da atividade.',
] as const

export const createActivityUpdateFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const activityId = requiredRelationshipFormValue(formData, 'activityId')
      const body = requiredFormText(formData, 'body')
      await appendActivityUpdate(activityId, body)
      revalidatePath('/campanha/atividades/[slug]', 'page')
      return { message: 'Atualização registrada com sucesso.' }
    },
    safeMessages,
    genericMessage:
      'Não foi possível enviar a atualização. Verifique seu acesso e tente novamente.',
  })
