'use server'

import config from '@payload-config'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import {
  CAMPAIGN_ACCOUNT_LOCKED_MESSAGE,
  CAMPAIGN_LOGIN_INVALID_CREDENTIALS_MESSAGE,
} from '@/lib/campaignAuthCopy'
import { CAMPAIGN_SESSION_TTL_LONG, CAMPAIGN_SESSION_TTL_SHORT } from '@/lib/campaignSessionTtl'
import { checkboxFormValue, requiredFormSecret, requiredFormText } from '@/lib/formData'
import { campaignLoginSchema, type CampaignLoginInput } from '@/lib/schemas/campaign-login'
import {
  CAMPAIGN_TOKEN_COOKIE,
  clearCampaignAuthCookie,
  revokeCampaignSession,
  setCampaignAuthCookie,
} from '@/utilities/campaignAuth'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const isLockedAuthError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error as { name: unknown }).name === 'LockedAuth'

export const loginCampaign = async (input: CampaignLoginInput): Promise<CampaignFormActionState> => {
  const parsed = campaignLoginSchema.safeParse(input)

  if (!parsed.success) {
    return mapCampaignFormActionError({
      error: parsed.error,
      genericMessage: 'Dados inválidos.',
    })
  }

  const payload = await getPayload({ config })
  const { identifier, password, rememberMe } = parsed.data

  let token: string | undefined

  try {
    const credentials = identifier.includes('@')
      ? { email: identifier, password }
      : { username: identifier, password }

    const result = await payload.login({
      collection: 'campaignUser',
      data: credentials,
    })

    token = result.token
  } catch (error) {
    if (isLockedAuthError(error)) {
      return { message: CAMPAIGN_ACCOUNT_LOCKED_MESSAGE }
    }
    return { message: CAMPAIGN_LOGIN_INVALID_CREDENTIALS_MESSAGE }
  }

  if (!token) {
    return { message: CAMPAIGN_LOGIN_INVALID_CREDENTIALS_MESSAGE }
  }

  await setCampaignAuthCookie(
    token,
    payload,
    rememberMe ? CAMPAIGN_SESSION_TTL_LONG : CAMPAIGN_SESSION_TTL_SHORT,
  )

  redirect('/campanha')
}

export const loginCampaignFormAction = async (
  _previousState: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const result = await loginCampaign({
      identifier: requiredFormText(formData, 'identifier'),
      password: requiredFormSecret(formData, 'password'),
      rememberMe: checkboxFormValue(formData, 'rememberMe'),
    })
    return result
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error
    return mapCampaignFormActionError({
      error,
      genericMessage: 'Dados inválidos.',
    })
  }
}

export const logoutCampaign = async (): Promise<void> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(CAMPAIGN_TOKEN_COOKIE)?.value

  if (token) {
    try {
      const payload = await getPayload({ config })
      await revokeCampaignSession(token, payload)
    } catch {
      // Cookie deletion must still succeed if the token is malformed or revocation is unavailable.
    }
  }

  await clearCampaignAuthCookie()

  redirect('/campanha/login')
}
