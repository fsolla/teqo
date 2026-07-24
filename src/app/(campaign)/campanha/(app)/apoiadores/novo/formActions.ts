'use server'

import { revalidatePath } from 'next/cache'

import { createSupporter } from '@/app/(campaign)/campanha/actions/supporter'
import {
  checkboxFormValue,
  nullableRelationshipFormValue,
  optionalFormText,
} from '@/lib/formData'
import { supporterCreateSchema } from '@/lib/schemas/supporter'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'
import { sanitizeBrazilianPhoneInput } from '@/utilities/phone'

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
  'Esta pessoa já está cadastrada como apoiador nesta Praça.',
  'Existe mais de um contato com este celular. Resolva a duplicidade no admin antes de continuar.',
  'Somente a coordenação e a assessoria podem gerenciar apoiadores.',
  'Somente o Coordenador Geral pode cadastrar apoiadores sem município.',
  'Consentimento de cadastro de apoiador ainda não configurado.',
  'Consentimento de intenção de voto ainda não configurado.',
] as const

const getSupporterFormError = (
  error: unknown,
  values?: SupporterFormValues,
  revision?: number,
): SupporterFormState =>
  mapCampaignFormActionError({
    error,
    safeMessages: safeActionMessages,
    genericMessage: 'Não foi possível cadastrar o apoiador. Verifique os dados e tente novamente.',
    values,
    revision,
  })

export const createSupporterFormAction = async (
  state: SupporterFormState,
  formData: FormData,
): Promise<SupporterFormState> => {
  let values: SupporterFormValues | undefined
  const revision = (state.revision ?? 0) + 1

  try {
    values = {
      name: optionalFormText(formData, 'name'),
      phone: optionalFormText(formData, 'phone'),
      email: optionalFormText(formData, 'email'),
      city: optionalFormText(formData, 'city'),
      municipality: optionalFormText(formData, 'municipality'),
      voteIntention: optionalFormText(formData, 'voteIntention'),
    }

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
      status: 'success',
      message: supporter.contactReused
        ? 'Apoiador cadastrado. O contato existente com este celular foi reutilizado.'
        : 'Apoiador cadastrado com sucesso.',
      supporterId: supporter.id,
    }
  } catch (error) {
    return getSupporterFormError(error, values, revision)
  }
}
