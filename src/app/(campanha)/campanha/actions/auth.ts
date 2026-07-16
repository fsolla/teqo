'use server'

import config from '@payload-config'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { campaignLoginSchema, type CampaignLoginInput } from '@/lib/schemas/campaign-login'
import { CAMPAIGN_TOKEN_COOKIE } from '@/utilities/campaignAuth'

const COOKIE_PATH = '/campanha'
const DEFAULT_TOKEN_EXPIRATION = 7200

export type LoginResult = { error: string }

export const loginCampaign = async (input: CampaignLoginInput): Promise<LoginResult> => {
  const parsed = campaignLoginSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const payload = await getPayload({ config })

  let token: string | undefined

  try {
    const result = await payload.login({
      collection: 'campaignUser',
      data: parsed.data,
    })

    token = result.token
  } catch {
    return { error: 'Email ou senha inválidos.' }
  }

  if (!token) {
    return { error: 'Email ou senha inválidos.' }
  }

  const tokenExpiration =
    payload.collections.campaignUser?.config.auth?.tokenExpiration ?? DEFAULT_TOKEN_EXPIRATION

  const cookieStore = await cookies()

  cookieStore.set(CAMPAIGN_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: tokenExpiration,
  })

  redirect('/campanha')
}

export const logoutCampaign = async (): Promise<void> => {
  const cookieStore = await cookies()

  cookieStore.set(CAMPAIGN_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: 0,
  })

  redirect('/campanha/login')
}
