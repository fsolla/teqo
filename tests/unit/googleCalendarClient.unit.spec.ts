// @vitest-environment node

import { exportPKCS8, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  buildServiceAccountAssertion,
  createGoogleCalendarClient,
  GOOGLE_CALENDAR_SCOPE,
  GoogleCalendarApiError,
  type FetchLike,
  type GoogleCalendarCredentials,
} from '@/utilities/googleCalendarClient'

describe('buildServiceAccountAssertion', () => {
  let credentials: GoogleCalendarCredentials
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
  let credentials: GoogleCalendarCredentials

  beforeAll(async () => {
    // The token endpoint is stubbed, but the client still SIGNS the JWT
    // assertion before posting — a real key keeps the tests honest.
    const { privateKey } = await generateKeyPair('RS256', { extractable: true })
    credentials = {
      clientEmail: 'teqo-sa@projeto.iam.gserviceaccount.com',
      privateKey: await exportPKCS8(privateKey),
    }
  })

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
    const client = createGoogleCalendarClient(credentials, fetchImpl)

    await client.insertEvent(calendarId, { id: 'teqo1a', summary: 'S', description: 'D' })

    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('teqo1a')
    const insertCall = calls.find((call) => call.method === 'POST' && call.url.includes('/events'))
    expect(insertCall?.url).toContain(`/calendars/${encodeURIComponent(calendarId)}/events`)
    expect(insertCall?.auth).toBe('Bearer token-1')
  })

  it('lists with the window params and pagination', async () => {
    const { fetchImpl, calls } = stubTransport()
    const client = createGoogleCalendarClient(credentials, fetchImpl)

    await client.listEvents(calendarId, {
      timeMin: '2026-01-01T00:00:00Z',
      timeMax: '2026-12-31T00:00:00Z',
    })

    const listCall = calls.find((call) => call.method === 'GET')
    expect(listCall?.url).toContain('timeMin=2026-01-01T00%3A00%3A00Z')
    expect(listCall?.url).toContain('timeMax=2026-12-31T00%3A00%3A00Z')
    expect(listCall?.url).toContain('maxResults=2500')
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

    const client = createGoogleCalendarClient(credentials, fetchImpl)
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

    const client = createGoogleCalendarClient(credentials, fetchImpl)
    await expect(
      client.listEvents(calendarId, { timeMin: 'a', timeMax: 'b' }),
    ).rejects.toBeInstanceOf(GoogleCalendarApiError)
  })
})
