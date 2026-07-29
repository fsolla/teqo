'use server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { createLeadership } from '@/app/(campaign)/campanha/actions/leadership'
import { optionalFormText, repeatedRelationshipFormValues, requiredFormText } from '@/lib/formData'
import {
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  leadershipSectors,
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
      const sector = optionalFormText(formData, 'sector')
      const supportStatus = optionalFormText(formData, 'supportStatus')

      return createLeadership({
        name: requiredFormText(formData, 'name'),
        phone: requiredFormText(formData, 'phone'),
        email: optionalFormText(formData, 'email'),
        municipalities: repeatedRelationshipFormValues(formData, 'municipalities'),
        organizations: repeatedRelationshipFormValues(formData, 'organizations'),
        stateDeputies: repeatedRelationshipFormValues(formData, 'stateDeputies'),
        sector: leadershipSectors.includes(sector as (typeof leadershipSectors)[number])
          ? (sector as (typeof leadershipSectors)[number])
          : undefined,
        supportStatus: leadershipSupportStatuses.includes(
          supportStatus as (typeof leadershipSupportStatuses)[number],
        )
          ? (supportStatus as (typeof leadershipSupportStatuses)[number])
          : 'a_abordar',
        notes: optionalFormText(formData, 'notes'),
        consentNote: optionalFormText(formData, 'consentNote'),
      })
    },
    redirectTo: (leadership) => `/campanha/liderancas/${leadership.id}`,
    safeMessages,
    genericMessage: 'Não foi possível cadastrar a liderança. Verifique os dados e tente novamente.',
  })
