'use server'

import { revalidatePath } from 'next/cache'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import {
  createLeadershipWizard,
  updateLeadershipWizard,
} from '@/app/(campaign)/campanha/actions/leadership'
import { declareVotes } from '@/app/(campaign)/campanha/actions/votePledge'
import {
  optionalFormText,
  requiredFormText,
  requiredIntegerFormValue,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { MAX_VOTE_COUNT } from '@/lib/schemas/primitives'
import { WIZARD_LEADERSHIP_VOTES_SAVED } from '@/lib/campaignWizardCopy'
import { VOTE_PLEDGE_DECLARE_SAFE_MESSAGES } from '@/lib/schemas/votePledge'
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
import {
  CONTACT_PHONE_AMBIGUOUS_MESSAGE,
  CONTACT_PHONE_CONFLICT_MESSAGE,
} from '@/utilities/contactPhoneInvariant'

const safeMessages = [
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_INVALID_CONTACT_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  CONTACT_PHONE_AMBIGUOUS_MESSAGE,
  CONTACT_PHONE_CONFLICT_MESSAGE,
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

export const declareVotesWizardFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
      const leadership = requiredRelationshipFormValue(formData, 'leadershipId')
      const declaredVotes = requiredIntegerFormValue(formData, 'declaredVotes', {
        minimum: 0,
        maximum: MAX_VOTE_COUNT,
      })

      await declareVotes({ municipality, leadership, declaredVotes })
      revalidatePath('/campanha/acoes/atualizar-lideranca', 'page')
      return { message: WIZARD_LEADERSHIP_VOTES_SAVED }
    },
    safeMessages: VOTE_PLEDGE_DECLARE_SAFE_MESSAGES,
    genericMessage:
      'Não foi possível registrar a declaração. Verifique seu acesso e tente novamente.',
  })
