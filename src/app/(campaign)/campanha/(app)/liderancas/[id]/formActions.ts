'use server'

import { revalidatePath } from 'next/cache'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import {
  setLeadershipAdvisorMembership,
  updateLeadershipInternal,
} from '@/app/(campaign)/campanha/actions/leadership'
import {
  nullableFormText,
  optionalFormText,
  repeatedRelationshipFormValues,
  requiredFormBoolean,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  LEADERSHIP_ADVISORS_CAP_MESSAGE,
  LEADERSHIP_ADVISORS_UNRESTRICTED_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  leadershipSupportStatuses,
} from '@/lib/schemas/leadership'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const safeMessages = [
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  LEADERSHIP_ADVISORS_UNRESTRICTED_MESSAGE,
  LEADERSHIP_ADVISORS_CAP_MESSAGE,
  ...leadershipStaffEditSafeMessages,
] as const

export const updateLeadershipInternalFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const supportStatus = optionalFormText(formData, 'supportStatus')

      await updateLeadershipInternal({
        id: requiredRelationshipFormValue(formData, 'leadershipId'),
        municipalities: repeatedRelationshipFormValues(formData, 'municipalities'),
        organizations: repeatedRelationshipFormValues(formData, 'organizations'),
        stateDeputies: repeatedRelationshipFormValues(formData, 'stateDeputies'),
        exclusive: formData.get('exclusive') === 'true',
        supportStatus: leadershipSupportStatuses.includes(
          supportStatus as (typeof leadershipSupportStatuses)[number],
        )
          ? (supportStatus as (typeof leadershipSupportStatuses)[number])
          : undefined,
        notes: nullableFormText(formData, 'notes'),
      })
      revalidatePath('/campanha/liderancas/[id]', 'page')
      return { message: 'Ficha da liderança atualizada.' }
    },
    safeMessages,
    genericMessage: 'Não foi possível salvar a ficha. Verifique seu acesso e tente novamente.',
  })

/** One chip toggle in the "Assessores responsáveis" section (C99). */
export const setLeadershipAdvisorMembershipFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setLeadershipAdvisorMembership({
        leadershipId: requiredRelationshipFormValue(formData, 'leadershipId'),
        advisorId: requiredRelationshipFormValue(formData, 'advisorId'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Assessores atualizados.' }
    },
    safeMessages,
    genericMessage: 'Não foi possível atualizar os assessores. Tente novamente.',
  })
