'use server'

import { revalidatePath } from 'next/cache'

import { updateNucleus } from '@/app/(campaign)/campanha/actions/nucleus'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'
import { parseNucleusIntelligenceFormData } from '@/utilities/nucleusIntelligenceUi'

export type NucleusIntelligenceFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
}

export const updateNucleusIntelligenceFormAction = async (
  _state: NucleusIntelligenceFormState,
  formData: FormData,
): Promise<NucleusIntelligenceFormState> => {
  try {
    const input = parseNucleusIntelligenceFormData(formData)
    await updateNucleus(input)
    revalidatePath('/campanha/nucleos/[slug]', 'page')
    return { status: 'success', message: 'Inteligência do núcleo atualizada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      genericMessage:
        'Não foi possível atualizar a inteligência. Verifique os dados e tente novamente.',
    })
  }
}
