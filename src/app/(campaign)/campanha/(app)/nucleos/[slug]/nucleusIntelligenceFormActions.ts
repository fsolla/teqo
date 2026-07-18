'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'

import { updateNucleus } from '@/app/(campaign)/campanha/actions/nucleus'
import { FormDataBoundaryError, validationFieldErrors } from '@/lib/formData'
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
    if (error instanceof FormDataBoundaryError) {
      return { fieldErrors: { [error.field]: [error.message] } }
    }
    if (error instanceof ZodError) return { fieldErrors: validationFieldErrors(error) }
    return {
      message: 'Não foi possível atualizar a inteligência. Verifique os dados e tente novamente.',
    }
  }
}
