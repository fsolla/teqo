'use server'

import { redirect } from 'next/navigation'

import {
  redeemCampaignInviteAutofill,
  redeemCampaignInviteLogin,
} from '@/app/(campaign)/campanha/actions/invite'
import {
  checkboxFormValue,
  nullableFormText,
  requiredFormSecret,
  requiredFormText,
} from '@/lib/formData'
import { campaignInviteAutofillSchema, campaignInviteLoginSchema } from '@/lib/schemas/invite'
import {
  mapCampaignFormActionError,
  runCampaignFormAction,
} from '@/utilities/campaignFormActionError'

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

const inviteFormError = (error: unknown): CampaignInviteFormState =>
  mapCampaignFormActionError({
    error,
    genericMessage:
      'Este convite não está disponível. Peça um novo convite à pessoa que falou com você.',
  })

export const redeemCampaignInviteAutofillFormAction = async (
  token: string,
  _state: CampaignInviteFormState,
  formData: FormData,
): Promise<CampaignInviteFormState> =>
  runCampaignFormAction({
    execute: async () => {
      const input = campaignInviteAutofillSchema.parse({
        token,
        ...profileFromForm(formData),
        consentAccepted: checkboxFormValue(formData, 'consentAccepted'),
      })
      await redeemCampaignInviteAutofill(input)
      return { message: 'Seus dados foram confirmados com sucesso.' }
    },
    genericMessage:
      'Este convite não está disponível. Peça um novo convite à pessoa que falou com você.',
  })

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
