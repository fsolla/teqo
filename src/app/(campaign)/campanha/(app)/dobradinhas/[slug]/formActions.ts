'use server'

import { revalidatePath } from 'next/cache'

import {
  setStateDeputyAdvisorMembership,
  updateStateDeputy,
} from '@/app/(campaign)/campanha/actions/stateDeputy'
import {
  nullableFormText,
  requiredFormBoolean,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  STATE_DEPUTY_ADVISOR_SAFE_MESSAGES,
  STATE_DEPUTY_STAFF_MESSAGE,
} from '@/lib/schemas/stateDeputy'
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
    safeMessages: [STATE_DEPUTY_STAFF_MESSAGE],
    genericMessage: 'Não foi possível salvar a dobradinha. Verifique seu acesso e tente novamente.',
  })

/** One chip toggle in the "Assessores responsáveis" section (B156). */
export const setStateDeputyAdvisorMembershipFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setStateDeputyAdvisorMembership({
        stateDeputyId: requiredRelationshipFormValue(formData, 'stateDeputyId'),
        advisorId: requiredRelationshipFormValue(formData, 'advisorId'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Assessores atualizados.' }
    },
    safeMessages: STATE_DEPUTY_ADVISOR_SAFE_MESSAGES,
    genericMessage: 'Não foi possível atualizar os assessores. Tente novamente.',
  })
