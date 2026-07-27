'use server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { setLeadershipStateDeputyMembership } from '@/app/(campaign)/campanha/actions/leadership'
import { requiredFormBoolean, requiredRelationshipFormValue } from '@/lib/formData'
import { MAX_LEADERSHIP_STATE_DEPUTIES } from '@/lib/schemas/leadership'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const safeMessages = [
  ...leadershipStaffEditSafeMessages,
  `Cada liderança aceita no máximo ${MAX_LEADERSHIP_STATE_DEPUTIES} dobradinhas.`,
] as const

/** One chip toggle in the "Dobradinhas" column of `/campanha/liderancas` (B31). */
export const setLeadershipStateDeputyMembershipFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await setLeadershipStateDeputyMembership({
        leadershipId: requiredRelationshipFormValue(formData, 'leadershipId'),
        stateDeputyId: requiredRelationshipFormValue(formData, 'stateDeputyId'),
        assigned: requiredFormBoolean(formData, 'assigned'),
      })
      return { message: 'Dobradinhas atualizadas.' }
    },
    safeMessages,
    genericMessage: 'Não foi possível atualizar as dobradinhas. Tente novamente.',
  })
