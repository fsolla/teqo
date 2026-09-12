// @vitest-environment node

import { exportPKCS8, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  buildServiceAccountAssertion,
  createGoogleCalendarClient,
  GOOGLE_CALENDAR_SCOPE,
  GoogleCalendarApiError,
  GoogleCalendarAuthError,
  type FetchLike,
  type GoogleCalendarAuth,
  type GoogleCalendarServiceAccountCredentials,
} from '@/utilities/googleCalendarClient'

describe('buildServiceAccountAssertion', () => {
  let credentials: GoogleCalendarServiceAccountCredentials
  let publicKeyPem: string

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })
    credentials = {
      clientEmail: 'teqo-sa@projeto.iam.gserviceaccount.com',
      privateKey: await exportPKCS8(privateKey),
    }
    publicKeyPem = await exportSPKI(publicKey)
  })

  it('signs an RS256 JWT with the service-account claims the token endpoint expects', async () => {
    const assertion = await buildServiceAccountAssertion(credentials, 1_800_000_000)
    const { payload } = await jwtVerify(assertion, await importSPKI(publicKeyPem, 'RS256'))

    expect(payload.iss).toBe(credentials.clientEmail)
    expect(payload.aud).toBe('https://oauth2.googleapis.com/token')
    expect(payload.scope).toBe(GOOGLE_CALENDAR_SCOPE)
    expect(payload.iat).toBe(1_800_000_000)
    expect((payload.exp as number) - (payload.iat as number)).toBe(3600)
  })
})

describe('createGoogleCalendarClient', () => {
  let credentials: GoogleCalendarServiceAccountCredentials
  let serviceAccountAuth: GoogleCalendarAuth

  beforeAll(async () => {
    // The token endpoint is stubbed, but the client still SIGNS the JWT
    // assertion before posting — a real key keeps the tests honest.
    const { privateKey } = await generateKeyPair('RS256', { extractable: true })
    credentials = {
      clientEmail: 'teqo-sa@projeto.iam.gserviceaccount.com',
      privateKey: await exportPKCS8(privateKey),
    }
    serviceAccountAuth = { kind: 'service-account', credentials }
  })

  const oauthAuth: GoogleCalendarAuth = {
    kind: 'oauth',
    credentials: {
      clientId: 'client-id.apps.googleusercontent.com',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token',
    },
  }

  const calendarId = 'c_abc@group.calendar.google.com'

  /** Minimal fake transport: token endpoint + calendar REST in memory. */
  const stubTransport = (events: Array<Record<string, unknown>> = []) => {
    let tokenRequests = 0
    const calls: Array<{ url: string; method: string; body?: string; auth?: string }> = []

    const fetchImpl: FetchLike = (async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      const method = (_init?.method ?? 'GET').toUpperCase()
      const body = typeof _init?.body === 'string' ? _init.body : undefined
      const auth = (_init?.headers as Record<string, string> | undefined)?.['Authorization']
      calls.push({ url, method, body, auth })

      if (url === 'https://oauth2.googleapis.com/token') {
        tokenRequests += 1
        return new Response(
          JSON.stringify({ access_token: `token-${tokenRequests}`, expires_in: 3600 }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (url.includes('/events') && method === 'POST') {
        const event = JSON.parse(body ?? '{}') as Record<string, unknown>
        events.push(event)
        return new Response(JSON.stringify(event), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/events') && method === 'PUT') {
        const event = JSON.parse(body ?? '{}') as Record<string, unknown>
        const index = events.findIndex((e) => e.id === event.id)
        if (index >= 0) events[index] = event
        return new Response(JSON.stringify(event), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/events') && method === 'DELETE') {
        const eventId = url.split('/').pop()
        const index = events.findIndex((e) => e.id === eventId)
        if (index >= 0) events.splice(index, 1)
        return new Response(null, { status: 204 })
      }
      if (url.includes('/events')) {
        return new Response(JSON.stringify({ items: events }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('not found', { status: 404 })
    }) as FetchLike

    return { fetchImpl, calls, events, getTokenRequests: () => tokenRequests }
  }

  it('inserts with the deterministic id, bearer auth and JSON body', async () => {
    const { fetchImpl, calls, events } = stubTransport()
    const client = createGoogleCalendarClient(serviceAccountAuth, fetchImpl)

    await client.insertEvent(calendarId, { id: 'teqo1a', summary: 'S', description: 'D' })

    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('teqo1a')
    const insertCall = calls.find((call) => call.method === 'POST' && call.url.includes('/events'))
    expect(insertCall?.url).toContain(`/calendars/${encodeURIComponent(calendarId)}/events`)
    expect(insertCall?.auth).toBe('Bearer token-1')
  })

  it('lists with the window params and pagination', async () => {
    const { fetchImpl, calls } = stubTransport()
    const client = createGoogleCalendarClient(serviceAccountAuth, fetchImpl)

    await client.listEvents(calendarId, {
      timeMin: '2026-01-01T00:00:00Z',
      timeMax: '2026-12-31T00:00:00Z',
    })

    const listCall = calls.find((call) => call.method === 'GET')
    expect(listCall?.url).toContain('timeMin=2026-01-01T00%3A00%3A00Z')
    expect(listCall?.url).toContain('timeMax=2026-12-31T00%3A00%3A00Z')
    expect(listCall?.url).toContain('maxResults=2500')
  })

  it('lists writable calendars with pagination, hiding deleted and falling back the summary (C150)', async () => {
    const pages: Record<string, { items: Array<Record<string, unknown>>; nextPageToken?: string }> =
      {
        '': {
          items: [
            { id: 'primary-id', summary: 'Conta da campanha', primary: true, accessRole: 'owner' },
            { id: 'campaign-id', summary: 'Agenda da Campanha', accessRole: 'writer' },
            { id: 'no-summary-id' },
            { id: 'deleted-id', summary: 'Antiga', deleted: true },
          ],
          nextPageToken: 'page-2',
        },
        'page-2': {
          items: [{ id: 'second-page-id', summary: 'Segunda página' }],
        },
      }
    const calls: string[] = []
    const fetchImpl: FetchLike = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      calls.push(url)
      const pageToken = new URL(url).searchParams.get('pageToken') ?? ''
      return new Response(JSON.stringify(pages[pageToken]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as FetchLike

    const client = createGoogleCalendarClient(oauthAuth, fetchImpl)
    const calendars = await client.listCalendars()

    expect(calendars).toEqual([
      { id: 'primary-id', summary: 'Conta da campanha', primary: true },
      { id: 'campaign-id', summary: 'Agenda da Campanha', primary: false },
      { id: 'no-summary-id', summary: 'no-summary-id', primary: false },
      { id: 'second-page-id', summary: 'Segunda página', primary: false },
    ])
    expect(calls).toHaveLength(2)
    const first = new URL(calls[0])
    expect(first.pathname).toBe('/calendar/v3/users/me/calendarList')
    expect(first.searchParams.get('minAccessRole')).toBe('writer')
    expect(first.searchParams.get('showHidden')).toBe('true')
    expect(first.searchParams.get('maxResults')).toBe('250')
    expect(first.searchParams.get('fields')).toBe('items(id,summary,primary,deleted),nextPageToken')
    expect(new URL(calls[1]).searchParams.get('pageToken')).toBe('page-2')
  })

  it('maps invalid_grant on the calendar list to GoogleCalendarAuthError (C150)', async () => {
    const fetchImpl: FetchLike = (async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })) as FetchLike

    const client = createGoogleCalendarClient(oauthAuth, fetchImpl)
    await expect(client.listCalendars()).rejects.toBeInstanceOf(GoogleCalendarAuthError)
  })

  it('re-mints the token once on a 401 and retries the call', async () => {
    let calendarCalls = 0
    const fetchImpl: FetchLike = (async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({ access_token: 'fresh-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      calendarCalls += 1
      if (calendarCalls === 1) {
        return new Response('unauthorized', { status: 401 })
      }
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as FetchLike

    const client = createGoogleCalendarClient(serviceAccountAuth, fetchImpl)
    const events = await client.listEvents(calendarId, {
      timeMin: '2026-01-01T00:00:00Z',
      timeMax: '2026-12-31T00:00:00Z',
    })

    expect(events).toEqual([])
    expect(calendarCalls).toBe(2)
  })

  it('throws a typed error on a non-401 failure without leaking the body', async () => {
    const fetchImpl: FetchLike = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 403 })
      }
      return new Response('ok', { status: 200 })
    }) as FetchLike

    const client = createGoogleCalendarClient(serviceAccountAuth, fetchImpl)
    await expect(
      client.listEvents(calendarId, { timeMin: 'a', timeMax: 'b' }),
    ).rejects.toBeInstanceOf(GoogleCalendarApiError)
  })

  it('mints an access token with the OAuth refresh grant (C149)', async () => {
    const { fetchImpl, calls } = stubTransport()
    const client = createGoogleCalendarClient(oauthAuth, fetchImpl)

    await client.listEvents(calendarId, { timeMin: 'a', timeMax: 'b' })

    const tokenCall = calls.find((call) => call.url === 'https://oauth2.googleapis.com/token')
    const params = new URLSearchParams(tokenCall?.body)
    expect(params.get('grant_type')).toBe('refresh_token')
    expect(params.get('refresh_token')).toBe('refresh-token')
    expect(params.get('client_id')).toBe('client-id.apps.googleusercontent.com')
    expect(params.get('client_secret')).toBe('client-secret')
    const listCall = calls.find((call) => call.method === 'GET')
    expect(listCall?.auth).toBe('Bearer token-1')
  })

  it('maps invalid_grant to GoogleCalendarAuthError (reconnectable)', async () => {
    const fetchImpl: FetchLike = (async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })) as FetchLike

    const client = createGoogleCalendarClient(oauthAuth, fetchImpl)
    await expect(
      client.listEvents(calendarId, { timeMin: 'a', timeMax: 'b' }),
    ).rejects.toBeInstanceOf(GoogleCalendarAuthError)
  })

  it('keeps invalid_client as an API error (reconnect would not fix it)', async () => {
    const fetchImpl: FetchLike = (async () =>
      new Response(JSON.stringify({ error: 'invalid_client' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })) as FetchLike

    const client = createGoogleCalendarClient(oauthAuth, fetchImpl)
    await expect(
      client.listEvents(calendarId, { timeMin: 'a', timeMax: 'b' }),
    ).rejects.toBeInstanceOf(GoogleCalendarApiError)
  })

  it('re-mints the OAuth token once on a 401 and retries the call', async () => {
    let calendarCalls = 0
    let tokenRequests = 0
    const fetchImpl: FetchLike = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === 'https://oauth2.googleapis.com/token') {
        tokenRequests += 1
        return new Response(
          JSON.stringify({ access_token: `oauth-token-${tokenRequests}`, expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      calendarCalls += 1
      if (calendarCalls === 1) return new Response('unauthorized', { status: 401 })
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as FetchLike

    const client = createGoogleCalendarClient(oauthAuth, fetchImpl)
    const events = await client.listEvents(calendarId, { timeMin: 'a', timeMax: 'b' })

    expect(events).toEqual([])
    expect(calendarCalls).toBe(2)
    expect(tokenRequests).toBe(2)
  })
})
