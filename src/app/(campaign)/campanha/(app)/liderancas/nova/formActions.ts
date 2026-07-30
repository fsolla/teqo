'use server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { createLeadership } from '@/app/(campaign)/campanha/actions/leadership'
import { optionalFormText, repeatedRelationshipFormValues, requiredFormText } from '@/lib/formData'
import {
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  leadershipSupportStatuses,
} from '@/lib/schemas/leadership'
import {
  runCampaignRedirectFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { CONTACT_PHONE_AMBIGUOUS_MESSAGE } from '@/utilities/contactPhoneInvariant'

const safeMessages = [
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  ...leadershipStaffEditSafeMessages,
  CONTACT_PHONE_AMBIGUOUS_MESSAGE,
] as const

export const createLeadershipFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignRedirectFormAction({
    execute: () => {
      const supportStatus = optionalFormText(formData, 'supportStatus')
      // Checkbox ambiguity: unchecked submits nothing, so the form pairs the
      // checkbox with a hidden "false"; last value wins. A genuinely absent
      // key (tests, non-form callers) falls back to the schema default.
      const exclusiveValues = formData.getAll('exclusive')

      return createLeadership({
        name: requiredFormText(formData, 'name'),
        phone: requiredFormText(formData, 'phone'),
        email: optionalFormText(formData, 'email'),
        municipalities: repeatedRelationshipFormValues(formData, 'municipalities'),
        organizations: repeatedRelationshipFormValues(formData, 'organizations'),
        stateDeputies: repeatedRelationshipFormValues(formData, 'stateDeputies'),
        exclusive: exclusiveValues.length === 0 ? undefined : exclusiveValues.at(-1) === 'true',
        supportStatus: leadershipSupportStatuses.includes(
          supportStatus as (typeof leadershipSupportStatuses)[number],
        )
          ? (supportStatus as (typeof leadershipSupportStatuses)[number])
          : 'a_abordar',
        notes: optionalFormText(formData, 'notes'),
      })
    },
    redirectTo: (leadership) => `/campanha/liderancas/${leadership.id}`,
    safeMessages,
    genericMessage: 'Não foi possível cadastrar a liderança. Verifique os dados e tente novamente.',
  })
