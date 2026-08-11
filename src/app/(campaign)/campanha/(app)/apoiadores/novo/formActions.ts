'use server'

import { revalidatePath } from 'next/cache'

import { createSupporter } from '@/app/(campaign)/campanha/actions/supporter'
import {
  SUPPORTER_REGISTRATION_CONSENT_MISSING_MESSAGE,
  SUPPORTER_VOTE_INTENTION_CONSENT_MISSING_MESSAGE,
} from '@/lib/campaignConsentKeys'
import {
  checkboxFormValue,
  nullableRelationshipFormValue,
  optionalFormText,
  repeatedPhoneFormValues,
} from '@/lib/formData'
import {
  SUPPORTER_DUPLICATE_MESSAGE,
  SUPPORTER_STAFF_MESSAGE,
  SUPPORTER_UNSCOPED_COORDINATOR_MESSAGE,
  supporterCreateSchema,
} from '@/lib/schemas/supporter'
import { runCampaignFormAction } from '@/utilities/campaignFormActionError'

export type SupporterFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
  supporterId?: number
  values?: SupporterFormValues
  revision?: number
}

type SupporterFormValues = {
  name?: string
  phones?: string[]
  email?: string
  city?: string
  municipality?: string
  voteIntention?: string
}

const safeActionMessages = [
  SUPPORTER_DUPLICATE_MESSAGE,
  SUPPORTER_STAFF_MESSAGE,
  SUPPORTER_UNSCOPED_COORDINATOR_MESSAGE,
  SUPPORTER_REGISTRATION_CONSENT_MISSING_MESSAGE,
  SUPPORTER_VOTE_INTENTION_CONSENT_MISSING_MESSAGE,
] as const

export const createSupporterFormAction = async (
  state: SupporterFormState,
  formData: FormData,
): Promise<SupporterFormState> => {
  // Parsed before the ladder (non-throwing readers) so failures echo them back.
  const values: SupporterFormValues = {
    name: optionalFormText(formData, 'name'),
    phones: repeatedPhoneFormValues(formData, 'phones'),
    email: optionalFormText(formData, 'email'),
    city: optionalFormText(formData, 'city'),
    municipality: optionalFormText(formData, 'municipality'),
    voteIntention: optionalFormText(formData, 'voteIntention'),
  }

  return runCampaignFormAction({
    execute: async () => {
      const voteIntention = values.voteIntention?.trim() || undefined

      const municipality = nullableRelationshipFormValue(formData, 'municipality')
      const input = supporterCreateSchema.parse({
        name: values.name ?? '',
        phones: values.phones ?? [],
        email: values.email,
        city: values.city,
        ...(municipality ? { municipality } : {}),
        ...(voteIntention ? { voteIntention } : {}),
        consentAccepted: checkboxFormValue(formData, 'consentAccepted') ? true : undefined,
        voteIntentionConsentAccepted: voteIntention
          ? checkboxFormValue(formData, 'voteIntentionConsentAccepted')
          : undefined,
      })

      const supporter = await createSupporter(input)
      revalidatePath('/campanha/apoiadores')

      return {
        message: supporter.contactReused
          ? 'Apoiador cadastrado. O contato existente com este celular foi reutilizado.'
          : 'Apoiador cadastrado com sucesso.',
        supporterId: supporter.id,
      }
    },
    safeMessages: safeActionMessages,
    genericMessage: 'Não foi possível cadastrar o apoiador. Verifique os dados e tente novamente.',
    values,
    revision: (state.revision ?? 0) + 1,
  })
}
