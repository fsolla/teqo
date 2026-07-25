'use server'

import { revalidatePath } from 'next/cache'

import { createSupporter } from '@/app/(campaign)/campanha/actions/supporter'
import {
  checkboxFormValue,
  nullableRelationshipFormValue,
  optionalFormText,
} from '@/lib/formData'
import { supporterCreateSchema } from '@/lib/schemas/supporter'
import { runCampaignFormAction } from '@/utilities/campaignFormActionError'
import { sanitizeBrazilianPhoneInput } from '@/lib/phone'

export type SupporterFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
  supporterId?: number
  values?: SupporterFormValues
  revision?: number
}

export type SupporterFormValues = {
  name?: string
  phone?: string
  email?: string
  city?: string
  municipality?: string
  voteIntention?: string
}

const safeActionMessages = [
  'Esta pessoa já está cadastrada como apoiador neste município.',
  'Existe mais de um contato com este celular. Resolva a duplicidade no admin antes de continuar.',
  'Somente a coordenação e a assessoria podem gerenciar apoiadores.',
  'Somente o Coordenador Geral pode cadastrar apoiadores sem município.',
  'Consentimento de cadastro de apoiador ainda não configurado.',
  'Consentimento de intenção de voto ainda não configurado.',
] as const

export const createSupporterFormAction = async (
  state: SupporterFormState,
  formData: FormData,
): Promise<SupporterFormState> => {
  // Parsed before the ladder (non-throwing readers) so failures echo them back.
  const values: SupporterFormValues = {
    name: optionalFormText(formData, 'name'),
    phone: optionalFormText(formData, 'phone'),
    email: optionalFormText(formData, 'email'),
    city: optionalFormText(formData, 'city'),
    municipality: optionalFormText(formData, 'municipality'),
    voteIntention: optionalFormText(formData, 'voteIntention'),
  }

  return runCampaignFormAction({
    execute: async () => {
      const phone = sanitizeBrazilianPhoneInput(values.phone ?? '')
      const voteIntention = values.voteIntention?.trim() || undefined

      const municipality = nullableRelationshipFormValue(formData, 'municipality')
      const input = supporterCreateSchema.parse({
        name: values.name ?? '',
        phone,
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
