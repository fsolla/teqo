'use server'

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
import { campaignInviteAutofillSchema, campaignInviteLoginFormSchema } from '@/lib/schemas/invite'
import {
  runCampaignFormAction,
  runCampaignRedirectFormAction,
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
): Promise<CampaignInviteFormState> =>
  runCampaignRedirectFormAction({
    execute: async () => {
      const input = campaignInviteLoginFormSchema.parse({
        token,
        ...profileFromForm(formData),
        password: requiredFormSecret(formData, 'password'),
        passwordConfirmation: requiredFormSecret(formData, 'passwordConfirmation'),
        consentAccepted: checkboxFormValue(formData, 'consentAccepted'),
      })
      await redeemCampaignInviteLogin(input)
    },
    redirectTo: () => '/campanha',
    genericMessage:
      'Este convite não está disponível. Peça um novo convite à pessoa que falou com você.',
  })
