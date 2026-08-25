import 'server-only'

import { importPKCS8, SignJWT } from 'jose'

import type { GoogleRemoteEvent } from '@/lib/googleCalendarEventMapping'

/**
 * C114 — thin Calendar API v3 client authenticated as the campaign's service
 * account (JWT assertion → OAuth2 token → REST). Only the four event endpoints
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
/**
 * Every outbound call carries a hard timeout so a hanging Google never holds
 * the activity write path (the afterChange hook awaits the sync) — Teqo's
 * availability cannot depend on Google's.
 * Exported for the hook pin test (C114-LOCK: hook < per-hop).
 */
export const REQUEST_TIMEOUT_MS = 15_000

export type { GoogleRemoteEvent } from '@/lib/googleCalendarEventMapping'

export type GoogleCalendarCredentials = {
  clientEmail: string
  privateKey: string
}

/** Typed transport failure — safe message, never echoes credentials or bodies. */
export class GoogleCalendarApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GoogleCalendarApiError'
    this.status = status
  }
}

export type GoogleCalendarClient = {
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
  credentials: GoogleCalendarCredentials,
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

export const createGoogleCalendarClient = (
  credentials: GoogleCalendarCredentials,
  fetchImpl: FetchLike = fetch,
  hookSignal?: AbortSignal,
): GoogleCalendarClient => {
  let cachedToken: { value: string; expiresAtMs: number } | null = null

  const requestSignal = (): AbortSignal => {
    const perHop = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    return hookSignal ? AbortSignal.any([hookSignal, perHop]) : perHop
  }

  const requestAccessToken = async (): Promise<string> => {
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

    const body = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!body.access_token) {
      throw new GoogleCalendarApiError('Resposta de autenticação do Google sem token.', 502)
    }

    cachedToken = {
      value: body.access_token,
      expiresAtMs: Date.now() + (body.expires_in ?? GOOGLE_TOKEN_TTL_SECONDS) * 1000,
    }
    return cachedToken.value
  }

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

  return { listEvents, insertEvent, updateEvent, deleteEvent, watchEvents, stopChannel }
}
