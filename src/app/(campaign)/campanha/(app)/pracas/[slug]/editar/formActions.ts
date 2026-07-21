'use server'

import { updatePlazaStrategy } from '@/app/(campaign)/campanha/actions/plaza'
import {
  nullableFormText,
  optionalFormText,
  optionalIntegerFormValue,
  optionalPlazaSlugFromForm,
  repeatedFormTexts,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { revalidatePlazaListPaths } from '@/utilities/plazaRevalidation'
import { plazaStaffEditSafeMessages } from '../../plazaStaffEditMessages'

export const updatePlazaStrategyFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const plaza = requiredRelationshipFormValue(formData, 'plazaId')
    const priority = optionalFormText(formData, 'priority')

    await updatePlazaStrategy({
      plaza,
      priority: priority === 'alta' ? 'alta' : 'normal',
      voteGoals: {
        good: optionalIntegerFormValue(formData, 'goalGood') ?? null,
        regular: optionalIntegerFormValue(formData, 'goalRegular') ?? null,
        minimum: optionalIntegerFormValue(formData, 'goalMinimum') ?? null,
      },
      strengths: repeatedFormTexts(formData, 'strengths'),
      risks: repeatedFormTexts(formData, 'risks'),
      dobradinhaNotes: nullableFormText(formData, 'dobradinhaNotes'),
      nextSteps: nullableFormText(formData, 'nextSteps'),
    })
    revalidatePlazaListPaths({ slug: optionalPlazaSlugFromForm(formData) })
    return { status: 'success', message: 'Estratégia atualizada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: [
        'As metas devem seguir a ordem Bom ≥ Regular ≥ Mínimo quando informadas.',
        ...plazaStaffEditSafeMessages,
      ],
      genericMessage:
        'Não foi possível salvar a estratégia. Verifique seu acesso e tente novamente.',
    })
  }
}
