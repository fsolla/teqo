'use server'

import { leadershipStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/liderancas/leadershipStaffEditMessages'
import { updateLeadershipContact } from '@/app/(campaign)/campanha/actions/leadership'
import { nullableFormText, requiredFormText, requiredRelationshipFormValue } from '@/lib/formData'
import {
  LEADERSHIP_INVALID_CONTACT_MESSAGE,
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
} from '@/lib/schemas/leadership'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import {
  CONTACT_PHONE_AMBIGUOUS_MESSAGE,
  CONTACT_PHONE_CONFLICT_MESSAGE,
} from '@/utilities/contactPhoneInvariant'

const INVALID_FIELD_MESSAGE = 'Campo inválido.'

const safeMessages = [
  ...leadershipStaffEditSafeMessages,
  LEADERSHIP_INVALID_CONTACT_MESSAGE,
  LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  CONTACT_PHONE_AMBIGUOUS_MESSAGE,
  CONTACT_PHONE_CONFLICT_MESSAGE,
  INVALID_FIELD_MESSAGE,
] as const

/** Per-field Contact edit for B153 (lista + detalhe). */
export const updateLeadershipContactFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const id = requiredRelationshipFormValue(formData, 'leadershipId')
      const field = requiredFormText(formData, 'field')

      if (field === 'name') {
        await updateLeadershipContact({
          id,
          field: 'name',
          name: requiredFormText(formData, 'name'),
        })
      } else if (field === 'email') {
        await updateLeadershipContact({
          id,
          field: 'email',
          email: nullableFormText(formData, 'email') ?? undefined,
        })
      } else if (field === 'phone') {
        await updateLeadershipContact({
          id,
          field: 'phone',
          phone: nullableFormText(formData, 'phone'),
        })
      } else {
        throw new Error(INVALID_FIELD_MESSAGE)
      }

      return { message: 'Salvo.' }
    },
    safeMessages,
    genericMessage: 'Não foi possível salvar. Verifique os dados e tente novamente.',
  })
