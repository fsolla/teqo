'use server'

import config from '@payload-config'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import {
  CAMPAIGN_ACCOUNT_LOCKED_MESSAGE,
  CAMPAIGN_LOGIN_INVALID_CREDENTIALS_MESSAGE,
} from '@/lib/campaignAuthCopy'
import { requiredFormSecret, requiredFormText } from '@/lib/formData'
import { campaignLoginSchema, type CampaignLoginInput } from '@/lib/schemas/campaign-login'
import {
  CAMPAIGN_COOKIE_PATH,
  CAMPAIGN_TOKEN_COOKIE,
  setCampaignAuthCookie,
} from '@/utilities/campaignAuth'

export type LoginResult = { error?: string }

const isLockedAuthError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error as { name: unknown }).name === 'LockedAuth'

export const loginCampaign = async (input: CampaignLoginInput): Promise<LoginResult> => {
  const parsed = campaignLoginSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const payload = await getPayload({ config })

  let token: string | undefined

  try {
    const { identifier, password } = parsed.data
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
      return { error: CAMPAIGN_ACCOUNT_LOCKED_MESSAGE }
    }
    return { error: CAMPAIGN_LOGIN_INVALID_CREDENTIALS_MESSAGE }
  }

  if (!token) {
    return { error: CAMPAIGN_LOGIN_INVALID_CREDENTIALS_MESSAGE }
  }

  await setCampaignAuthCookie(token, payload)

  redirect('/campanha')
}

export const loginCampaignFormAction = async (
  _previousState: LoginResult,
  formData: FormData,
): Promise<LoginResult> => {
  try {
    return loginCampaign({
      identifier: requiredFormText(formData, 'identifier'),
      password: requiredFormSecret(formData, 'password'),
    })
  } catch {
    return { error: 'Dados inválidos.' }
  }
}

export const logoutCampaign = async (): Promise<void> => {
  const cookieStore = await cookies()

  cookieStore.set(CAMPAIGN_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: CAMPAIGN_COOKIE_PATH,
    maxAge: 0,
  })

  redirect('/campanha/login')
}
