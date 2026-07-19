import 'server-only'

import type { CampaignUser } from '@/payload-types'

import configPromise from '@payload-config'
import { cookies } from 'next/headers'
import { getPayload, type Payload } from 'payload'
import { cache } from 'react'

export const CAMPAIGN_TOKEN_COOKIE = 'campaign-token'
export const CAMPAIGN_COOKIE_PATH = '/campanha'
const DEFAULT_TOKEN_EXPIRATION = 7200

type CampaignAuthPayload = Pick<Payload, 'auth' | 'findByID'>
type CampaignCookiePayload = Pick<Payload, 'collections'>
export type AuthenticatedCampaignUser = CampaignUser & { email: string }

export const authenticateCampaignToken = async (
  token: string,
  payload: CampaignAuthPayload,
): Promise<AuthenticatedCampaignUser | null> => {
  try {
    const headers = new Headers({ Authorization: `JWT ${token}` })
    const { user } = await payload.auth({ headers })

    if (user?.collection !== 'campaignUser') return null

    const currentUser = await payload.findByID({
      collection: 'campaignUser',
      id: user.id,
      depth: 1,
    })

    return {
      ...currentUser,
      email: currentUser.email ?? '',
    }
  } catch {
    return null
  }
}

export const getCampaignUserRaw = async (): Promise<AuthenticatedCampaignUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(CAMPAIGN_TOKEN_COOKIE)?.value

  if (!token) return null

  const payload = await getPayload({ config: configPromise })

  return authenticateCampaignToken(token, payload)
}

export const getCampaignUser = cache(getCampaignUserRaw)

export const setCampaignAuthCookie = async (
  token: string,
  payload: CampaignCookiePayload,
): Promise<void> => {
  const tokenExpiration =
    payload.collections.campaignUser?.config.auth?.tokenExpiration ?? DEFAULT_TOKEN_EXPIRATION
  const cookieStore = await cookies()

  cookieStore.set(CAMPAIGN_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: CAMPAIGN_COOKIE_PATH,
    maxAge: tokenExpiration,
  })
}

export const campaignLoginCredentials = (
  user: { email?: string | null; username?: string | null },
  password: string,
): { email: string; password: string } | { username: string; password: string } | null => {
  if (user.email) return { email: user.email, password }
  if (user.username) return { username: user.username, password }
  return null
}
