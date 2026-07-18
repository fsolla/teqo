'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'

import { createSupporter } from '@/app/(campaign)/campanha/actions/supporter'
import {
  checkboxFormValue,
  FormDataBoundaryError,
  nullableRelationshipFormValue,
  optionalFormText,
  validationFieldErrors,
} from '@/lib/formData'
import { supporterCreateSchema } from '@/lib/schemas/supporter'
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
  nucleus?: string
  voteIntention?: string
}

const safeActionMessages = [
  'Esta pessoa já está cadastrada como apoiador neste núcleo.',
  'Existe mais de um contato com este celular. Resolva a duplicidade no admin antes de continuar.',
  'Somente a coordenação pode gerenciar apoiadores.',
  'Somente a coordenação geral pode cadastrar apoiadores sem núcleo.',
  'Consentimento de cadastro de apoiador ainda não configurado.',
  'Consentimento de intenção de voto ainda não configurado.',
] as const

const getSupporterFormError = (
  error: unknown,
  values?: SupporterFormValues,
  revision?: number,
): SupporterFormState => {
  if (error instanceof FormDataBoundaryError) {
    return { fieldErrors: { [error.field]: [error.message] }, values, revision }
  }
  if (error instanceof ZodError) {
    return { fieldErrors: validationFieldErrors(error), values, revision }
  }
  if (
    error instanceof Error &&
    safeActionMessages.includes(error.message as (typeof safeActionMessages)[number])
  ) {
    return { message: error.message, values, revision }
  }
  return {
    message: 'Não foi possível cadastrar o apoiador. Verifique os dados e tente novamente.',
    values,
    revision,
  }
}

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
      nucleus: optionalFormText(formData, 'nucleus'),
      voteIntention: optionalFormText(formData, 'voteIntention'),
    }

    const phone = sanitizeBrazilianPhoneInput(values.phone ?? '')
    const voteIntention = values.voteIntention?.trim() || undefined

    const nucleus = nullableRelationshipFormValue(formData, 'nucleus')
    const input = supporterCreateSchema.parse({
      name: values.name ?? '',
      phone,
      email: values.email,
      city: values.city,
      ...(nucleus ? { nucleus } : {}),
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
