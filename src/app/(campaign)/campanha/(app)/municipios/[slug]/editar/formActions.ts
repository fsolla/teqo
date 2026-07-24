'use server'

import { updateMunicipalityStrategy } from '@/app/(campaign)/campanha/actions/municipality'
import {
  nullableFormText,
  optionalFormText,
  optionalIntegerFormValue,
  optionalMunicipalitySlugFromForm,
  repeatedFormTexts,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { revalidateMunicipalityListPaths } from '@/utilities/municipalityRevalidation'
import { municipalityStaffEditSafeMessages } from '../../municipalityStaffEditMessages'

export const updateMunicipalityStrategyFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
    const priority = optionalFormText(formData, 'priority')

    await updateMunicipalityStrategy({
      municipality,
      priority: priority === 'alta' ? 'alta' : 'normal',
      voteGoals: {
        good: optionalIntegerFormValue(formData, 'goalGood') ?? null,
        regular: optionalIntegerFormValue(formData, 'goalRegular') ?? null,
        minimum: optionalIntegerFormValue(formData, 'goalMinimum') ?? null,
      },
      strengths: repeatedFormTexts(formData, 'strengths'),
      risks: repeatedFormTexts(formData, 'risks'),
      stateDeputies: repeatedRelationshipFormValues(formData, 'stateDeputies'),
      dobradinhaNotes: nullableFormText(formData, 'dobradinhaNotes'),
      nextSteps: nullableFormText(formData, 'nextSteps'),
    })
    revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
    return { status: 'success', message: 'Estratégia atualizada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: [
        'As metas devem seguir a ordem Bom ≥ Regular ≥ Mínimo quando informadas.',
        ...municipalityStaffEditSafeMessages,
      ],
      genericMessage:
        'Não foi possível salvar a estratégia. Verifique seu acesso e tente novamente.',
    })
  }
}
