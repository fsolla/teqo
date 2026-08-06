'use server'

import { createStateDeputy } from '@/app/(campaign)/campanha/actions/stateDeputy'
import { optionalFormText, requiredFormText } from '@/lib/formData'
import {
  STATE_DEPUTY_CONFLICT_MESSAGE,
  STATE_DEPUTY_STAFF_MESSAGE,
} from '@/lib/schemas/stateDeputy'
import {
  runCampaignRedirectFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

export const createStateDeputyFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignRedirectFormAction({
    execute: () =>
      createStateDeputy({
        name: requiredFormText(formData, 'name'),
        party: optionalFormText(formData, 'party'),
        notes: optionalFormText(formData, 'notes'),
      }),
    redirectTo: (stateDeputy) => `/campanha/dobradinhas/${stateDeputy.id}`,
    safeMessages: [STATE_DEPUTY_CONFLICT_MESSAGE, STATE_DEPUTY_STAFF_MESSAGE],
    genericMessage:
      'Não foi possível cadastrar a dobradinha. Verifique os dados e tente novamente.',
  })
