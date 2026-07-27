'use server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { createLeadership } from '@/app/(campaign)/campanha/actions/leadership'
import { optionalFormText, repeatedRelationshipFormValues, requiredFormText } from '@/lib/formData'
import { leadershipSectors, leadershipSupportStatuses } from '@/lib/schemas/leadership'
import {
  runCampaignRedirectFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const safeMessages = [
  'Esta pessoa já está cadastrada como liderança. Edite a ficha existente para vincular novos municípios.',
  'Você só pode vincular lideranças aos municípios que assessora.',
  ...leadershipStaffEditSafeMessages,
  'Existe mais de um contato com este celular. Resolva a duplicidade no admin antes de continuar.',
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
