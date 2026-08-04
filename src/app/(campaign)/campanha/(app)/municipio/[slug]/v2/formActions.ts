'use server'

import { createMunicipalityUpdate } from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import {
  optionalFormText,
  optionalMunicipalitySlugFromForm,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { parseMunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'
import { WIZARD_SIGNAL_SAVED_MESSAGE } from '@/lib/wizardSignalUi'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'

/** Thin alias — same write path as the list signal control (B147). */
export const createMunicipalityV2SignalFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipality = requiredRelationshipFormValue(formData, 'municipalityId')

      await createMunicipalityUpdate({
        municipality,
        kind: 'sinal',
        body: optionalFormText(formData, 'body'),
        signalType: parseMunicipalitySignalType(optionalFormText(formData, 'signalType')),
      })
      revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
      return { message: WIZARD_SIGNAL_SAVED_MESSAGE }
    },
    genericMessage: 'Não foi possível registrar o sinal. Verifique seu acesso e tente novamente.',
  })
