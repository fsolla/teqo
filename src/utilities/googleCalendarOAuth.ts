import 'server-only'

import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'

import {
  GOOGLE_CALENDAR_OAUTH_CALLBACK_PATH,
  GOOGLE_CALENDAR_OAUTH_SCOPES,
} from '@/lib/googleCalendarOAuth'
import { getCampaignInviteBaseURL } from '@/utilities/campaignInviteOrigin'

/**
 * C149 — the server side of the campaign's Google OAuth handshake: the client
 * credential pair (env), the public redirect URI, the signed single-use
 * `state` cookie and the authorization-code exchange.
 *
 * No token ever crosses this module's messages: the exchange reads only
 * `refresh_token`/`scope` and fails with a safe, fixed pt-BR message — the
 * response body is never echoed and never logged.
 */

export const GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV = 'GOOGLE_CALENDAR_OAUTH_CLIENT_ID'
export const GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV = 'GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET'

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const STATE_COOKIE_NAME = 'campaign-google-oauth-state'
const STATE_COOKIE_PATH = '/campanha'
const STATE_TTL_MS = 10 * 60 * 1000
const REQUEST_TIMEOUT_MS = 15_000

export type GoogleCalendarOAuthClientCredentials = {
  clientId: string
  clientSecret: string
}

/**
 * Reads the OAuth client pair from the environment. Fail-closed: a partial or
 * absent pair disables the connect button (the view exposes `oauthAvailable`)
 * without breaking the service-account fallback. Never logs the values.
 */
export const readGoogleCalendarOAuthCredentials =
  (): GoogleCalendarOAuthClientCredentials | null => {
    const clientId = process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV]?.trim()
    const clientSecret = process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV]?.trim()
    if (!clientId || !clientSecret) return null
    return { clientId, clientSecret }
  }

/**
 * The redirect URI registered in the GCP OAuth client. Always the canonical
 * public origin (production requires `NEXT_PUBLIC_SITE_URL`), never the
 * request URL — so a callback behind the Cloudflare tunnel cannot leak
 * localhost into the redirect.
 */
export const buildGoogleCalendarOAuthRedirectUri = (): string =>
  `${getCampaignInviteBaseURL()}${GOOGLE_CALENDAR_OAUTH_CALLBACK_PATH}`

export class GoogleCalendarOAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleCalendarOAuthError'
  }
}

const GOOGLE_CALENDAR_OAUTH_STATE_EXPIRED_MESSAGE =
  'A conexão com o Google expirou. Tente conectar novamente.'

const getSecret = (): string => {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET não configurado para o state do OAuth.')
  return secret
}

const signature = (state: string, userId: string, expiresAt: number): Buffer =>
  createHmac('sha256', getSecret()).update(`${state}.${userId}.${expiresAt}`).digest()

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  maxAge,
  path: STATE_COOKIE_PATH,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
})

/**
 * Stores the signed, time-boxed `state` — the CSRF/replay guard of the
 * handshake, bound to the campaign user that started it (precedent:
 * `campaignWebAuthnChallenge`).
 */
export const storeGoogleCalendarOAuthState = async (
  state: string,
  userId: number,
): Promise<void> => {
  const expiresAt = Date.now() + STATE_TTL_MS
  const sig = signature(state, String(userId), expiresAt).toString('base64url')

  const cookieStore = await cookies()
  cookieStore.set(
    STATE_COOKIE_NAME,
    `${state}.${userId}.${expiresAt}.${sig}`,
    cookieOptions(Math.ceil(STATE_TTL_MS / 1000)),
  )
}

/**
 * Verifies the cookie against the `state` Google echoed back and returns the
 * user that started the flow. Anything wrong (missing, malformed, stale,
 * forged, mismatched) is the same event from the user's side.
 */
export const readGoogleCalendarOAuthState = async (
  providedState: string,
): Promise<{ userId: number }> => {
  const cookieStore = await cookies()
  const raw = cookieStore.get(STATE_COOKIE_NAME)?.value

  const invalid = () => new GoogleCalendarOAuthError(GOOGLE_CALENDAR_OAUTH_STATE_EXPIRED_MESSAGE)
  if (!raw) throw invalid()

  const [state, userIdText, expiresAtText, sig, ...rest] = raw.split('.')
  if (!state || !userIdText || !expiresAtText || !sig || rest.length > 0) throw invalid()

  const expiresAt = Number(expiresAtText)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) throw invalid()

  const expected = signature(state, userIdText, expiresAt)
  const provided = Buffer.from(sig, 'base64url')
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) throw invalid()
  if (state !== providedState) throw invalid()

  const userId = Number(userIdText)
  if (!Number.isSafeInteger(userId) || userId <= 0) throw invalid()

  return { userId }
}

/** Burns the state so a captured callback cannot be replayed. */
export const clearGoogleCalendarOAuthState = async (): Promise<void> => {
  const cookieStore = await cookies()
  cookieStore.set(STATE_COOKIE_NAME, '', cookieOptions(0))
}

export type GoogleCalendarOAuthTokens = {
  refreshToken: string
  scope: string | null
}

/**
 * Exchanges the authorization code for the long-lived refresh token. The
 * response body is never echoed or logged: a non-OK answer collapses to a
 * fixed safe message, and a body without `refresh_token` tells the user to
 * remove the app access and try again (the case where Google does not reissue
 * a token for an already-granted consent).
 */
export const exchangeGoogleCalendarOAuthCode = async ({
  code,
  redirectUri,
  credentials,
  fetchImpl = fetch,
}: {
  code: string
  redirectUri: string
  credentials: GoogleCalendarOAuthClientCredentials
  fetchImpl?: typeof fetch
}): Promise<GoogleCalendarOAuthTokens> => {
  let response: Response
  try {
    response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new GoogleCalendarOAuthError('Não foi possível falar com o Google. Tente novamente.')
  }

  if (!response.ok) {
    throw new GoogleCalendarOAuthError('O Google recusou a autorização. Tente conectar novamente.')
  }

  const body = (await response.json().catch(() => null)) as {
    refresh_token?: unknown
    scope?: unknown
  } | null
  const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token : ''
  if (!refreshToken) {
    throw new GoogleCalendarOAuthError(
      'O Google não devolveu um token de atualização. Remova o acesso do Teqo na sua conta Google e tente conectar de novo.',
    )
  }

  const scope = typeof body?.scope === 'string' ? body.scope : null
  // Granular consent lets the user uncheck a scope: without `calendar.events`
  // the mirror would connect and then fail every pass with 403 — fail the
  // handshake instead, which lands on the reconnect path.
  if (scope) {
    const granted = new Set(scope.split(' ').filter(Boolean))
    if (GOOGLE_CALENDAR_OAUTH_SCOPES.some((required) => !granted.has(required))) {
      throw new GoogleCalendarOAuthError(
        'A autorização não inclui todas as permissões necessárias. Conecte novamente e aceite o acesso completo.',
      )
    }
  }

  return { refreshToken, scope }
}
