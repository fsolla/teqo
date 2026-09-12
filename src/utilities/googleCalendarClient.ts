import 'server-only'

import { importPKCS8, SignJWT } from 'jose'

import type { GoogleRemoteEvent } from '@/lib/googleCalendarEventMapping'

/**
 * C114 — thin Calendar API v3 client authenticated either as the campaign's
 * service account (JWT assertion → OAuth2 token → REST) or — C149 — with the
 * OAuth refresh token granted by the "Conectar com o Google" consent
 * (refresh_token grant → access token → REST). Only the four event endpoints
 * the reconciliation engine needs; the token is cached per runtime instance
 * and re-minted on 401. The `fetch` implementation is injectable so tests can
 * stub the transport without network.
 */

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_TOKEN_TTL_SECONDS = 3600
const TOKEN_REFRESH_LEAD_SECONDS = 60
const MAX_LIST_PAGE_SIZE = 2500
/** calendarList caps `maxResults` at 250 (unlike events). */
const CALENDAR_LIST_PAGE_SIZE = 250
/**
 * Every outbound call carries a hard timeout so a hanging Google never holds
 * the activity write path (the afterChange hook awaits the sync) — Teqo's
 * availability cannot depend on Google's.
 * Exported for the hook pin test (C114-LOCK: hook < per-hop).
 */
export const REQUEST_TIMEOUT_MS = 15_000

export type { GoogleRemoteEvent } from '@/lib/googleCalendarEventMapping'

export type GoogleCalendarServiceAccountCredentials = {
  clientEmail: string
  privateKey: string
}

/** C149 — the connection created by the OAuth consent (refresh token + app pair). */
type GoogleCalendarOAuthCredentials = {
  clientId: string
  clientSecret: string
  refreshToken: string
}

/**
 * How the client authenticates. The engine resolves OAuth first (when the
 * campaign connected an account) and falls back to the service account —
 * `googleCalendarSync.readGoogleCalendarAuth`.
 */
export type GoogleCalendarAuth =
  | { kind: 'service-account'; credentials: GoogleCalendarServiceAccountCredentials }
  | { kind: 'oauth'; credentials: GoogleCalendarOAuthCredentials }

/** Typed transport failure — safe message, never echoes credentials or bodies. */
export class GoogleCalendarApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GoogleCalendarApiError'
    this.status = status
  }
}

/**
 * C149 — the OAuth connection is dead (`invalid_grant`: the refresh token was
 * revoked or expired). Reconnectable by the user, unlike an API/config error:
 * the engine records it as the connection `error` state that offers
 * "Reconectar" in one click.
 */
export class GoogleCalendarAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleCalendarAuthError'
  }
}

/**
 * C150 — one entry of the connected account's calendar list, reduced to what
 * the picker renders. `summary` falls back to the id when Google omits it.
 */
export type GoogleCalendarListEntry = {
  id: string
  summary: string
  primary: boolean
}

export type GoogleCalendarClient = {
  /**
   * C150 — the calendars the connected account can WRITE to (`minAccessRole=writer`),
   * for the campaign's primary-calendar picker. The mirror only works on a
   * calendar the account owns/edits, so read-only subscriptions never show up.
   */
  listCalendars: () => Promise<GoogleCalendarListEntry[]>
  listEvents: (
    calendarId: string,
    range: { timeMin: string; timeMax: string },
  ) => Promise<GoogleRemoteEvent[]>
  insertEvent: (calendarId: string, event: GoogleRemoteEvent) => Promise<void>
  updateEvent: (calendarId: string, eventId: string, event: GoogleRemoteEvent) => Promise<void>
  deleteEvent: (calendarId: string, eventId: string) => Promise<void>
  /** C115 — push channel for the Google→Teqo direction (events.watch). */
  watchEvents: (
    calendarId: string,
    channel: { id: string; address: string; token: string; ttlSeconds: number },
  ) => Promise<GoogleWatchChannel>
  /** C115 — stops a push channel (channels.stop); used on renewal/calendar change. */
  stopChannel: (channel: { id: string; resourceId: string }) => Promise<void>
}

/** The `api#channel` the watch response returns. */
type GoogleWatchChannel = {
  id: string
  resourceId: string
  expiration: number | null
}

export type FetchLike = typeof fetch

/**
 * The signed JWT assertion for the OAuth2 token exchange (RFC 7523). Exported
 * for tests — `createGoogleCalendarClient` mints and exchanges it internally.
 */
export const buildServiceAccountAssertion = async (
  credentials: GoogleCalendarServiceAccountCredentials,
  nowSeconds: number,
): Promise<string> => {
  const key = await importPKCS8(credentials.privateKey, 'RS256')
  return new SignJWT({ scope: GOOGLE_CALENDAR_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(credentials.clientEmail)
    .setAudience(GOOGLE_TOKEN_ENDPOINT)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + GOOGLE_TOKEN_TTL_SECONDS)
    .sign(key)
}

/** Reads the token endpoint's error code without ever surfacing the body. */
const readOAuthErrorCode = async (response: Response): Promise<string | null> => {
  try {
    const body = (await response.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

export const createGoogleCalendarClient = (
  auth: GoogleCalendarAuth,
  fetchImpl: FetchLike = fetch,
  hookSignal?: AbortSignal,
): GoogleCalendarClient => {
  let cachedToken: { value: string; expiresAtMs: number } | null = null

  const requestSignal = (): AbortSignal => {
    const perHop = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    return hookSignal ? AbortSignal.any([hookSignal, perHop]) : perHop
  }

  const parseAccessToken = async (response: Response): Promise<string> => {
    const body = (await response.json().catch(() => null)) as {
      access_token?: unknown
      expires_in?: unknown
    } | null
    const accessToken = typeof body?.access_token === 'string' ? body.access_token : ''
    if (!accessToken) {
      throw new GoogleCalendarApiError('Resposta de autenticação do Google sem token.', 502)
    }
    const expiresIn =
      typeof body?.expires_in === 'number' && Number.isFinite(body.expires_in)
        ? body.expires_in
        : GOOGLE_TOKEN_TTL_SECONDS
    cachedToken = {
      value: accessToken,
      expiresAtMs: Date.now() + expiresIn * 1000,
    }
    return cachedToken.value
  }

  const requestServiceAccountAccessToken = async (
    credentials: GoogleCalendarServiceAccountCredentials,
  ): Promise<string> => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const assertion = await buildServiceAccountAssertion(credentials, nowSeconds)

    const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
      signal: requestSignal(),
    })
    if (!response.ok) {
      throw new GoogleCalendarApiError(
        `Não foi possível autenticar no Google (HTTP ${response.status}).`,
        response.status,
      )
    }
    return parseAccessToken(response)
  }

  const requestOAuthAccessToken = async (
    credentials: GoogleCalendarOAuthCredentials,
  ): Promise<string> => {
    const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }).toString(),
      signal: requestSignal(),
    })
    if (!response.ok) {
      // `invalid_grant` is the user-fixable case (token revoked/expired) and
      // becomes the reconnectable auth error. `invalid_client` (our app
      // credential is wrong) and transient failures stay API errors: telling
      // the user to reconnect would not fix them.
      if ((await readOAuthErrorCode(response)) === 'invalid_grant') {
        throw new GoogleCalendarAuthError(
          'A conexão com o Google expirou ou foi revogada. Reconecte a conta.',
        )
      }
      throw new GoogleCalendarApiError(
        `Não foi possível autenticar no Google (HTTP ${response.status}).`,
        response.status,
      )
    }
    return parseAccessToken(response)
  }

  const requestAccessToken = (): Promise<string> =>
    auth.kind === 'oauth'
      ? requestOAuthAccessToken(auth.credentials)
      : requestServiceAccountAccessToken(auth.credentials)

  const getAccessToken = async (): Promise<string> => {
    if (cachedToken && cachedToken.expiresAtMs > Date.now() + TOKEN_REFRESH_LEAD_SECONDS * 1000) {
      return cachedToken.value
    }
    return requestAccessToken()
  }

  const apiFetch = async (
    url: string,
    init: RequestInit = {},
    retried = false,
  ): Promise<Response> => {
    const token = await getAccessToken()
    const response = await fetchImpl(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      signal: requestSignal(),
    })

    // A 401 usually means the cached token expired server-side — re-mint once.
    if (response.status === 401 && !retried) {
      cachedToken = null
      return apiFetch(url, init, true)
    }
    if (!response.ok) {
      throw new GoogleCalendarApiError(
        `Google Calendar API respondeu HTTP ${response.status}.`,
        response.status,
      )
    }
    return response
  }

  const eventsUrl = (calendarId: string, ...parts: string[]): string =>
    `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events${parts
      .map((part) => `/${encodeURIComponent(part)}`)
      .join('')}`

  const listCalendars: GoogleCalendarClient['listCalendars'] = async () => {
    const calendars: GoogleCalendarListEntry[] = []
    let pageToken: string | undefined

    do {
      const params = new URLSearchParams({
        minAccessRole: 'writer',
        // A calendar the operation hid in the Google sidebar is still a valid
        // mirror target — hiding is a UI preference, not a permission.
        showHidden: 'true',
        maxResults: String(CALENDAR_LIST_PAGE_SIZE),
        fields: 'items(id,summary,primary,deleted),nextPageToken',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const response = await apiFetch(`${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList?${params}`)
      const body = (await response.json()) as {
        items?: Array<{ id?: unknown; summary?: unknown; primary?: unknown; deleted?: unknown }>
        nextPageToken?: string
      }
      for (const item of body.items ?? []) {
        // Deleted calendars linger in the list until Google purges them.
        if (typeof item.id !== 'string' || item.id.length === 0 || item.deleted === true) continue
        calendars.push({
          id: item.id,
          summary:
            typeof item.summary === 'string' && item.summary.length > 0 ? item.summary : item.id,
          primary: item.primary === true,
        })
      }
      pageToken = body.nextPageToken
    } while (pageToken)

    return calendars
  }

  const listEvents: GoogleCalendarClient['listEvents'] = async (calendarId, range) => {
    const events: GoogleRemoteEvent[] = []
    let pageToken: string | undefined

    do {
      const params = new URLSearchParams({
        timeMin: range.timeMin,
        timeMax: range.timeMax,
        maxResults: String(MAX_LIST_PAGE_SIZE),
        singleEvents: 'true',
        // C115 — cancelled (trashed) events are the "user cancelled this
        // commitment" signal the reverse direction acts on; without it a
        // deletion in Google would be invisible to the reconciliation.
        showDeleted: 'true',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const response = await apiFetch(`${eventsUrl(calendarId)}?${params.toString()}`)
      const body = (await response.json()) as {
        items?: GoogleRemoteEvent[]
        nextPageToken?: string
      }
      events.push(...(body.items ?? []))
      pageToken = body.nextPageToken
    } while (pageToken)

    return events
  }

  const insertEvent: GoogleCalendarClient['insertEvent'] = async (calendarId, event) => {
    try {
      await apiFetch(eventsUrl(calendarId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      })
    } catch (error) {
      // 409 = the deterministic id already exists (a concurrent pass inserted
      // it between our list and this insert) — the idempotent end state, not
      // a failure; the next pass converges on the content.
      if (!(error instanceof GoogleCalendarApiError && error.status === 409)) throw error
    }
  }

  const updateEvent: GoogleCalendarClient['updateEvent'] = async (calendarId, eventId, event) => {
    await apiFetch(eventsUrl(calendarId, eventId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
  }

  const deleteEvent: GoogleCalendarClient['deleteEvent'] = async (calendarId, eventId) => {
    await apiFetch(eventsUrl(calendarId, eventId), { method: 'DELETE' })
  }

  const watchEvents: GoogleCalendarClient['watchEvents'] = async (calendarId, channel) => {
    const response = await apiFetch(`${eventsUrl(calendarId)}/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: channel.id,
        type: 'web_hook',
        address: channel.address,
        token: channel.token,
        params: { ttl: String(channel.ttlSeconds) },
      }),
    })
    const body = (await response.json()) as {
      id?: string
      resourceId?: string
      expiration?: number | null
    }
    if (!body.id || !body.resourceId) {
      throw new GoogleCalendarApiError('O Google não devolveu um canal de notificação válido.', 502)
    }
    return {
      id: body.id,
      resourceId: body.resourceId,
      expiration: body.expiration ?? null,
    }
  }

  const stopChannel: GoogleCalendarClient['stopChannel'] = async ({ id, resourceId }) => {
    try {
      await apiFetch(`${GOOGLE_CALENDAR_API_BASE}/channels/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resourceId }),
      })
    } catch (error) {
      // Already stopped / unknown channel is the desired end state (404).
      if (!(error instanceof GoogleCalendarApiError && error.status === 404)) throw error
    }
  }

  return {
    listCalendars,
    listEvents,
    insertEvent,
    updateEvent,
    deleteEvent,
    watchEvents,
    stopChannel,
  }
}
