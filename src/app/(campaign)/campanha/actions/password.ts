'use server'

import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { requiredFormSecret, requiredFormText } from '@/lib/formData'
import {
  campaignChangePasswordSchema,
  campaignPasswordResetRequestSchema,
  campaignPasswordResetSchema,
} from '@/lib/schemas/campaignPassword'
import {
  assertCampaignEmailConfigured,
  CAMPAIGN_LEADERSHIP_FORGOT_PASSWORD_MESSAGE,
  CAMPAIGN_PASSWORD_RESET_GENERIC_MESSAGE,
  CAMPAIGN_PASSWORD_RESET_INVALID_TOKEN_MESSAGE,
  isCampaignEmailConfigured,
} from '@/utilities/campaignPasswordReset'
import { campaignLoginCredentials, getCampaignUser, setCampaignAuthCookie } from '@/utilities/campaignAuth'
import {
  CAMPAIGN_SESSION_EXPIRED_MESSAGE,
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { normalizeBrazilianPhone } from '@/lib/phone'

export const requestCampaignPasswordReset = async (
  input: { email: string },
): Promise<CampaignFormActionState> => {
  const parsed = campaignPasswordResetRequestSchema.safeParse(input)
  if (!parsed.success) {
    return mapCampaignFormActionError({
      error: parsed.error,
      genericMessage: CAMPAIGN_PASSWORD_RESET_GENERIC_MESSAGE,
    })
  }

  const payload = await getPayload({ config })

  try {
    assertCampaignEmailConfigured()

    await payload.forgotPassword({
      collection: 'campaignUser',
      data: { email: parsed.data.email },
      disableEmail: !isCampaignEmailConfigured(),
    })
  } catch {
    // Anti-enumeration: never reveal whether the account exists or email failed.
  }

  return {
    status: 'success',
    message: CAMPAIGN_PASSWORD_RESET_GENERIC_MESSAGE,
  }
}

export const requestCampaignPasswordResetFormAction = async (
  _previousState: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const email = requiredFormText(formData, 'email')
    const phone = normalizeBrazilianPhone(email)

    if (phone) {
      return {
        fieldErrors: {
          email: [CAMPAIGN_LEADERSHIP_FORGOT_PASSWORD_MESSAGE],
        },
      }
    }

    return requestCampaignPasswordReset({ email })
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      genericMessage: CAMPAIGN_PASSWORD_RESET_GENERIC_MESSAGE,
    })
  }
}

const resetCampaignPassword = async (
  input: { token: string; password: string; passwordConfirmation: string },
): Promise<CampaignFormActionState> => {
  const parsed = campaignPasswordResetSchema.safeParse(input)
  if (!parsed.success) {
    return mapCampaignFormActionError({
      error: parsed.error,
      genericMessage: 'Não foi possível redefinir a senha.',
    })
  }

  const payload = await getPayload({ config })

  try {
    const result = await payload.resetPassword({
      collection: 'campaignUser',
      data: {
        token: parsed.data.token,
        password: parsed.data.password,
      },
      overrideAccess: true,
    })

    if (!result.token) {
      return { message: 'Não foi possível redefinir a senha.' }
    }

    await setCampaignAuthCookie(result.token, payload)
  } catch {
    return { message: CAMPAIGN_PASSWORD_RESET_INVALID_TOKEN_MESSAGE }
  }

  return { status: 'success' as const }
}

export const resetCampaignPasswordFormAction = async (
  token: string,
  _previousState: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const result = await resetCampaignPassword({
      token,
      password: requiredFormSecret(formData, 'password'),
      passwordConfirmation: requiredFormSecret(formData, 'passwordConfirmation'),
    })
    if (result.status === 'success') {
      redirect('/campanha/perfil?passwordReset=1')
    }
    return result
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error
    return mapCampaignFormActionError({
      error,
      genericMessage: 'Não foi possível redefinir a senha.',
    })
  }
}

const changeCampaignPassword = async (
  input: { currentPassword: string; password: string; passwordConfirmation: string },
): Promise<CampaignFormActionState> => {
  const user = await getCampaignUser()
  if (!user) {
    return { message: CAMPAIGN_SESSION_EXPIRED_MESSAGE }
  }

  const parsed = campaignChangePasswordSchema.safeParse(input)
  if (!parsed.success) {
    return mapCampaignFormActionError({
      error: parsed.error,
      genericMessage: 'Não foi possível alterar a senha.',
    })
  }

  const payload = await getPayload({ config })
  const credentials = campaignLoginCredentials(user, parsed.data.currentPassword)
  if (!credentials) {
    return { message: 'Não foi possível validar a conta atual.' }
  }

  try {
    await payload.login({
      collection: 'campaignUser',
      data: credentials,
    })
  } catch {
    return {
      fieldErrors: {
        currentPassword: ['Senha atual incorreta.'],
      },
    }
  }

  try {
    await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { password: parsed.data.password },
      overrideAccess: true,
      user,
    })
  } catch {
    return { message: 'Não foi possível alterar a senha.' }
  }

  return {
    status: 'success',
    message: 'Senha alterada com sucesso.',
  }
}

export const changeCampaignPasswordFormAction = async (
  _previousState: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    return changeCampaignPassword({
      currentPassword: requiredFormSecret(formData, 'currentPassword'),
      password: requiredFormSecret(formData, 'password'),
      passwordConfirmation: requiredFormSecret(formData, 'passwordConfirmation'),
    })
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      genericMessage: 'Não foi possível alterar a senha.',
    })
  }
}
