'use server'

import { updateMunicipalityStrategy } from '@/app/(campaign)/campanha/actions/municipality'
import {
  nullableFormText,
  optionalFormText,
  optionalMunicipalitySlugFromForm,
  repeatedFormTexts,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { revalidateMunicipalityListPaths } from '@/utilities/municipalityRevalidation'
import { municipalityStaffEditSafeMessages } from '../../municipalityStaffEditMessages'

export const updateMunicipalityStrategyFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
      const priority = optionalFormText(formData, 'priority')

      await updateMunicipalityStrategy({
        municipality,
        priority: priority === 'alta' ? 'alta' : 'normal',
        strengths: repeatedFormTexts(formData, 'strengths'),
        risks: repeatedFormTexts(formData, 'risks'),
        stateDeputies: repeatedRelationshipFormValues(formData, 'stateDeputies'),
        dobradinhaNotes: nullableFormText(formData, 'dobradinhaNotes'),
        nextSteps: nullableFormText(formData, 'nextSteps'),
        budgetNotes: nullableFormText(formData, 'budgetNotes'),
      })
      revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
      return { message: 'Estratégia atualizada.' }
    },
    safeMessages: municipalityStaffEditSafeMessages,
    genericMessage:
      'Não foi possível salvar a estratégia. Verifique seu acesso e tente novamente.',
  })
