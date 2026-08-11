'use server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import {
  createLeadershipWizard,
  updateLeadershipWizard,
} from '@/app/(campaign)/campanha/actions/leadership'
import { optionalFormText, requiredFormText, requiredRelationshipFormValue } from '@/lib/formData'
import {
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_INVALID_CONTACT_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  isSupportStatus,
} from '@/lib/schemas/leadership'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const safeMessages = [
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_INVALID_CONTACT_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  ...leadershipStaffEditSafeMessages,
] as const

const parseExclusive = (formData: FormData): boolean | undefined => {
  const exclusiveValues = formData.getAll('exclusive')
  if (exclusiveValues.length === 0) return undefined
  return exclusiveValues.at(-1) === 'true'
}

const parseSupportStatus = (formData: FormData) => {
  const supportStatus = optionalFormText(formData, 'supportStatus')
  return isSupportStatus(supportStatus) ? supportStatus : 'a_abordar'
}

const wizardFieldsFromForm = (formData: FormData) => ({
  name: requiredFormText(formData, 'name'),
  phone: requiredFormText(formData, 'phone'),
  email: optionalFormText(formData, 'email'),
  exclusive: parseExclusive(formData),
  supportStatus: parseSupportStatus(formData),
  notes: optionalFormText(formData, 'notes'),
})

export const createLeadershipWizardFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await createLeadershipWizard(
        {
          ...wizardFieldsFromForm(formData),
          municipalityId: requiredRelationshipFormValue(formData, 'municipalityId'),
        },
        requiredFormText(formData, 'municipalitySlug'),
      )
      return { message: 'Liderança cadastrada.' }
    },
    safeMessages,
    genericMessage: 'Não foi possível cadastrar a liderança. Verifique os dados e tente novamente.',
  })

export const updateLeadershipWizardFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await updateLeadershipWizard(
        {
          ...wizardFieldsFromForm(formData),
          id: requiredRelationshipFormValue(formData, 'leadershipId'),
        },
        requiredFormText(formData, 'municipalitySlug'),
      )
      return { message: 'Liderança atualizada.' }
    },
    safeMessages,
    genericMessage: 'Não foi possível salvar a liderança. Verifique os dados e tente novamente.',
  })
