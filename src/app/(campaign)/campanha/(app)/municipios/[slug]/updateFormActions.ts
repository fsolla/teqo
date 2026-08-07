'use server'

import { revalidatePath } from 'next/cache'

import { createMunicipalityUpdate } from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import {
  optionalIntegerFormValue,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  MUNICIPALITY_UPDATE_POLARITY_REQUIRED_MESSAGE,
  parseMunicipalityUpdatePolarity,
} from '@/lib/schemas/municipalityUpdate'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

/** Checkbox pairs with hidden "false"; last value wins (same as leadership exclusive). */
const formBoolean = (formData: FormData, field: string): boolean => {
  const values = formData.getAll(field)
  if (values.length === 0) return false
  return values.at(-1) === 'true'
}

export const createMunicipalityUpdateFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
      const polarity = parseMunicipalityUpdatePolarity(requiredFormText(formData, 'polarity'))
      if (!polarity) {
        throw new Error(MUNICIPALITY_UPDATE_POLARITY_REQUIRED_MESSAGE)
      }

      await createMunicipalityUpdate({
        municipality,
        body: requiredFormText(formData, 'body'),
        polarity,
        urgent: formBoolean(formData, 'urgent'),
        activeVolunteers: optionalIntegerFormValue(formData, 'activeVolunteers'),
        newSupports: optionalIntegerFormValue(formData, 'newSupports'),
        adversarySignal: formBoolean(formData, 'adversarySignal'),
      })
      revalidatePath('/campanha/municipios/[slug]', 'page')
      return { message: 'Atualização registrada com sucesso.' }
    },
    genericMessage:
      'Não foi possível registrar a atualização. Verifique seu acesso e tente novamente.',
  })
