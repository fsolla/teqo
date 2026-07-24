'use server'

import { createStateDeputy } from '@/app/(campaign)/campanha/actions/stateDeputy'
import { optionalFormText, requiredFormText } from '@/lib/formData'
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
    redirectTo: (stateDeputy) => `/campanha/dobradinhas/${stateDeputy.slug}`,
    safeMessages: [
      'Já existe uma dobradinha com este nome.',
      'Somente a coordenação e a assessoria gerenciam dobradinhas.',
    ],
    genericMessage:
      'Não foi possível cadastrar a dobradinha. Verifique os dados e tente novamente.',
  })
