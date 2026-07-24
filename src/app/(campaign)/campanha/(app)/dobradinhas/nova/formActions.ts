'use server'

import { redirect } from 'next/navigation'

import { createStateDeputy } from '@/app/(campaign)/campanha/actions/stateDeputy'
import { nullableFormText, optionalFormText, requiredFormText } from '@/lib/formData'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

export const createStateDeputyFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  let createdSlug: string | null = null
  try {
    const stateDeputy = await createStateDeputy({
      name: requiredFormText(formData, 'name'),
      party: optionalFormText(formData, 'party'),
      notes: optionalFormText(formData, 'notes'),
    })
    createdSlug = stateDeputy.slug
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: [
        'Já existe uma dobradinha com este nome.',
        'Somente a coordenação e a assessoria gerenciam dobradinhas.',
      ],
      genericMessage:
        'Não foi possível cadastrar a dobradinha. Verifique os dados e tente novamente.',
    })
  }

  redirect(`/campanha/dobradinhas/${createdSlug}`)
}
