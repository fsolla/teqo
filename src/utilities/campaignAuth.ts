import 'server-only'

import type { CampaignUser } from '@/payload-types'

import configPromise from '@payload-config'
import { cookies } from 'next/headers'
import { createLocalReq, getPayload, jwtSign, logoutOperation, type Payload } from 'payload'
import { cache } from 'react'

import { CAMPAIGN_SESSION_TTL_LONG, CAMPAIGN_SESSION_TTL_SHORT } from '@/lib/campaignSessionTtl'

export const CAMPAIGN_TOKEN_COOKIE = 'campaign-token'
const CAMPAIGN_COOKIE_PATH = '/campanha'

type CampaignAuthPayload = Pick<Payload, 'auth' | 'findByID'>
type CampaignCookiePayload = Pick<Payload, 'secret'>
export type AuthenticatedCampaignUser = CampaignUser & { email: string }

/** Gate reload fields — kept as documentation for future partial selects. */
export const CAMPAIGN_AUTH_GATE_SELECT = {
  id: true,
  name: true,
  role: true,
  email: true,
  username: true,
  avatar: true,
} as const

type CampaignTokenClaims = Record<string, unknown> & {
  collection: 'campaignUser'
  id: number | string
  sid: string
}

const campaignTokenClaims = (token: string): CampaignTokenClaims => {
  try {
    const segments = token.split('.')
    if (segments.length !== 3 || !segments[1]) throw new Error('Malformed JWT')

    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/')
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const decoded = JSON.parse(atob(paddedBase64)) as unknown
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
      throw new Error('Invalid campaign claims')
    }
    const claims = decoded as CampaignTokenClaims
    if (
      (typeof claims.id !== 'number' && typeof claims.id !== 'string') ||
      claims.collection !== 'campaignUser' ||
      typeof claims.sid !== 'string'
    ) {
      throw new Error('Invalid campaign claims')
    }

    const { exp: _exp, iat: _iat, ...fieldsToSign } = claims
    return fieldsToSign
  } catch {
    throw new Error('Token de campanha inválido.')
  }
}

const campaignSessionToken = async (
  token: string,
  payload: CampaignCookiePayload,
  tokenExpiration: number,
): Promise<string> => {
  if (tokenExpiration === CAMPAIGN_SESSION_TTL_LONG) return token

  const { token: resignedToken } = await jwtSign({
    fieldsToSign: campaignTokenClaims(token),
    secret: payload.secret,
    tokenExpiration,
  })
  return resignedToken
}

export const revokeCampaignSession = async (token: string, payload: Payload): Promise<void> => {
  const headers = new Headers({ Authorization: `JWT ${token}` })
  const { user: authenticatedUser } = await payload.auth({ headers })
  if (authenticatedUser?.collection !== 'campaignUser') {
    throw new Error('Token de campanha inválido.')
  }

  const req = await createLocalReq(
    {
      req: { headers },
      user: authenticatedUser,
    },
    payload,
  )
  await logoutOperation({
    collection: payload.collections.campaignUser,
    req,
  })
}

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
      depth: 0,
    })

    return {
      ...currentUser,
      email: currentUser.email ?? '',
    }
  } catch {
    return null
  }
}

const readAuthenticatedCampaignUser = async (
  depth: 0 | 1,
): Promise<AuthenticatedCampaignUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(CAMPAIGN_TOKEN_COOKIE)?.value

  if (!token) return null

  const payload = await getPayload({ config: configPromise })
  const user = await authenticateCampaignToken(token, payload)
  if (!user) return null

  if (depth === 0) return user

  const withAvatar = await payload.findByID({
    collection: 'campaignUser',
    id: user.id,
    depth: 1,
  })

  return {
    ...withAvatar,
    email: withAvatar.email ?? '',
  }
}

export const getCampaignUserRaw = (): Promise<AuthenticatedCampaignUser | null> =>
  readAuthenticatedCampaignUser(0)

export const getCampaignUser = cache(getCampaignUserRaw)

export const getCampaignUserWithAvatarRaw = (): Promise<AuthenticatedCampaignUser | null> =>
  readAuthenticatedCampaignUser(1)

export const getCampaignUserWithAvatar = cache(getCampaignUserWithAvatarRaw)

/** Public auth routes — session probe without reloading the user document. */
export const hasCampaignSession = cache(async (): Promise<boolean> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(CAMPAIGN_TOKEN_COOKIE)?.value
  if (!token) return false

  try {
    const payload = await getPayload({ config: configPromise })
    const headers = new Headers({ Authorization: `JWT ${token}` })
    const { user } = await payload.auth({ headers })
    return user?.collection === 'campaignUser'
  } catch {
    return false
  }
})

const campaignCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  maxAge,
  path: CAMPAIGN_COOKIE_PATH,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
})

export const setCampaignAuthCookie = async (
  token: string,
  payload: CampaignCookiePayload,
  tokenExpiration: number = CAMPAIGN_SESSION_TTL_SHORT,
): Promise<void> => {
  const sessionToken = await campaignSessionToken(token, payload, tokenExpiration)
  const cookieStore = await cookies()

  cookieStore.set(CAMPAIGN_TOKEN_COOKIE, sessionToken, campaignCookieOptions(tokenExpiration))
}

export const clearCampaignAuthCookie = async (): Promise<void> => {
  const cookieStore = await cookies()
  cookieStore.set(CAMPAIGN_TOKEN_COOKIE, '', campaignCookieOptions(0))
}

export const campaignLoginCredentials = (
  user: { email?: string | null; username?: string | null },
  password: string,
): { email: string; password: string } | { username: string; password: string } | null => {
  if (user.email) return { email: user.email, password }
  if (user.username) return { username: user.username, password }
  return null
}
