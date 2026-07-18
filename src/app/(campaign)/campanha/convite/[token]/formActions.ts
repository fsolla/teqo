'use server'

import { redirect } from 'next/navigation'
import { ZodError } from 'zod'

import {
  redeemCampaignInviteAutofill,
  redeemCampaignInviteLogin,
} from '@/app/(campaign)/campanha/actions/invite'
import { campaignInviteAutofillSchema, campaignInviteLoginSchema } from '@/lib/schemas/invite'
import {
  checkboxFormValue,
  FormDataBoundaryError,
  nullableFormText,
  requiredFormSecret,
  requiredFormText,
  validationFieldErrors,
} from '@/lib/formData'

export type CampaignInviteFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
}

export type BoundCampaignInviteFormAction = (
  state: CampaignInviteFormState,
  formData: FormData,
) => Promise<CampaignInviteFormState>

const profileFromForm = (formData: FormData) => ({
  name: requiredFormText(formData, 'name'),
  phone: requiredFormText(formData, 'phone'),
  email: nullableFormText(formData, 'email'),
  gender: nullableFormText(formData, 'gender'),
  sector: nullableFormText(formData, 'sector'),
  sectorNotes: nullableFormText(formData, 'sectorNotes'),
})

const inviteFormError = (error: unknown): CampaignInviteFormState => {
  if (error instanceof FormDataBoundaryError) {
    return { fieldErrors: { [error.field]: [error.message] } }
  }
  if (error instanceof ZodError) {
    return { fieldErrors: validationFieldErrors(error) }
  }
  return {
    message: 'Este convite não está disponível. Peça um novo convite à pessoa que falou com você.',
  }
}

export const redeemCampaignInviteAutofillFormAction = async (
  token: string,
  _state: CampaignInviteFormState,
  formData: FormData,
): Promise<CampaignInviteFormState> => {
  try {
    const input = campaignInviteAutofillSchema.parse({
      token,
      ...profileFromForm(formData),
      consentAccepted: checkboxFormValue(formData, 'consentAccepted'),
    })
    await redeemCampaignInviteAutofill(input)
    return {
      status: 'success',
      message: 'Seus dados foram confirmados com sucesso.',
    }
  } catch (error) {
    return inviteFormError(error)
  }
}

export const redeemCampaignInviteLoginFormAction = async (
  token: string,
  _state: CampaignInviteFormState,
  formData: FormData,
): Promise<CampaignInviteFormState> => {
  let password: string
  try {
    password = requiredFormSecret(formData, 'password')
    if (password !== requiredFormSecret(formData, 'passwordConfirmation')) {
      return {
        fieldErrors: {
          passwordConfirmation: ['As senhas não coincidem.'],
        },
      }
    }
  } catch (error) {
    return inviteFormError(error)
  }
  try {
    const input = campaignInviteLoginSchema.parse({
      token,
      ...profileFromForm(formData),
      password,
      consentAccepted: checkboxFormValue(formData, 'consentAccepted'),
    })
    await redeemCampaignInviteLogin(input)
  } catch (error) {
    return inviteFormError(error)
  }

  redirect('/campanha')
}
