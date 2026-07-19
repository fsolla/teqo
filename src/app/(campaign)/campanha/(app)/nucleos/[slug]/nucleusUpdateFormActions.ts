'use server'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { revalidatePath } from 'next/cache'

import { createNucleusUpdateRecord } from '@/app/(campaign)/campanha/actions/nucleusUpdate'
import type { CampaignUser } from '@/payload-types'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'
import { parseNucleusUpdateFormData } from '@/utilities/nucleusUpdateUi'
import { requireRelationshipId } from '@/utilities/relationship'

export type NucleusUpdateFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
}

export const createNucleusUpdateFormRecordAction = async (
  payload: Payload,
  actor: CampaignUser,
  formData: FormData,
): Promise<NucleusUpdateFormState & { nucleusId?: number }> => {
  try {
    const input = parseNucleusUpdateFormData(formData)
    const created = await createNucleusUpdateRecord(payload, actor, input)
    return {
      status: 'success',
      message: 'Atualização enviada com sucesso.',
      nucleusId: requireRelationshipId(created.nucleus),
    }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      genericMessage: 'Não foi possível enviar a atualização. Verifique seu acesso e tente novamente.',
    })
  }
}

export const createNucleusUpdateFormAction = async (
  _state: NucleusUpdateFormState,
  formData: FormData,
): Promise<NucleusUpdateFormState> => {
  const [payload, actor] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!actor) {
    return {
      message: 'Não foi possível enviar a atualização. Verifique seu acesso e tente novamente.',
    }
  }

  const { nucleusId, ...state } = await createNucleusUpdateFormRecordAction(
    payload,
    actor,
    formData,
  )
  if (state.status === 'success' && nucleusId) {
    revalidatePath('/campanha')
    revalidatePath('/campanha/nucleos/[slug]', 'page')
  }
  return state
}
