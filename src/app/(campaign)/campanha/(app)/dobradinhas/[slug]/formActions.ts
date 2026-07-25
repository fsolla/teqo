'use server'

import { revalidatePath } from 'next/cache'

import { updateStateDeputy } from '@/app/(campaign)/campanha/actions/stateDeputy'
import { nullableFormText, requiredRelationshipFormValue } from '@/lib/formData'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

export const updateStateDeputyFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await updateStateDeputy({
        id: requiredRelationshipFormValue(formData, 'stateDeputyId'),
        party: nullableFormText(formData, 'party'),
        notes: nullableFormText(formData, 'notes'),
      })
      revalidatePath('/campanha/dobradinhas/[slug]', 'page')
      return { message: 'Dobradinha atualizada.' }
    },
    safeMessages: ['Somente a coordenação e a assessoria gerenciam dobradinhas.'],
    genericMessage:
      'Não foi possível salvar a dobradinha. Verifique seu acesso e tente novamente.',
  })
