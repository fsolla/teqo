// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest'

import {
  buildGoogleCalendarOAuthAuthorizeUrl,
  GOOGLE_CALENDAR_OAUTH_CALLBACK_PATH,
  GOOGLE_CALENDAR_OAUTH_SCOPES,
} from '@/lib/googleCalendarOAuth'
import {
  exchangeGoogleCalendarOAuthCode,
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV,
  GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV,
  GoogleCalendarOAuthError,
  readGoogleCalendarOAuthCredentials,
} from '@/utilities/googleCalendarOAuth'

const CREDENTIALS = {
  clientId: 'client-id.apps.googleusercontent.com',
  clientSecret: 'client-secret',
}
const REDIRECT_URI = `https://jorgesolla1313.com.br${GOOGLE_CALENDAR_OAUTH_CALLBACK_PATH}`

describe('buildGoogleCalendarOAuthAuthorizeUrl', () => {
  it('pins the two literal minimum scopes (C149)', () => {
    expect([...GOOGLE_CALENDAR_OAUTH_SCOPES]).toEqual([
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    ])
  })

  it('builds the consent URL with offline access, forced consent and the state', () => {
    const url = new URL(
      buildGoogleCalendarOAuthAuthorizeUrl({
        clientId: CREDENTIALS.clientId,
        redirectUri: REDIRECT_URI,
        state: 'state-123',
      }),
    )

    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe(CREDENTIALS.clientId)
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe(GOOGLE_CALENDAR_OAUTH_SCOPES.join(' '))
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.search).not.toContain('client_secret')
  })
})

describe('readGoogleCalendarOAuthCredentials', () => {
  const original = {
    id: process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV],
    secret: process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV],
  }

  afterEach(() => {
    if (original.id === undefined) delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV]
    else process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV] = original.id
    if (original.secret === undefined) delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV]
    else process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV] = original.secret
  })

  it('fails closed (null) when either side is missing', () => {
    delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV]
    delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV]
    expect(readGoogleCalendarOAuthCredentials()).toBeNull()

    process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV] = 'client-id'
    expect(readGoogleCalendarOAuthCredentials()).toBeNull()

    delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV]
    process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV] = 'client-secret'
    expect(readGoogleCalendarOAuthCredentials()).toBeNull()
  })

  it('returns the pair when both sides are set', () => {
    process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV] = 'client-id'
    process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV] = 'client-secret'
    expect(readGoogleCalendarOAuthCredentials()).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
    })
  })
})

describe('exchangeGoogleCalendarOAuthCode', () => {
  it('posts the authorization code and returns the refresh token + scope', async () => {
    const calls: Array<{ url: string; body?: string }> = []
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: typeof init?.body === 'string' ? init.body : '' })
      return new Response(
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          scope: GOOGLE_CALENDAR_OAUTH_SCOPES.join(' '),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as typeof fetch

    const tokens = await exchangeGoogleCalendarOAuthCode({
      code: 'code-123',
      redirectUri: REDIRECT_URI,
      credentials: CREDENTIALS,
      fetchImpl,
    })

    expect(tokens).toEqual({
      refreshToken: 'refresh-token',
      scope: GOOGLE_CALENDAR_OAUTH_SCOPES.join(' '),
    })
    const params = new URLSearchParams(calls[0]?.body)
    expect(calls[0]?.url).toBe('https://oauth2.googleapis.com/token')
    expect(params.get('grant_type')).toBe('authorization_code')
    expect(params.get('code')).toBe('code-123')
    expect(params.get('redirect_uri')).toBe(REDIRECT_URI)
    expect(params.get('client_id')).toBe(CREDENTIALS.clientId)
    expect(params.get('client_secret')).toBe(CREDENTIALS.clientSecret)
  })

  it('maps a non-OK response to a safe error without echoing the body', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: 'invalid_grant', secret: 'leak-me' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch

    const error = await exchangeGoogleCalendarOAuthCode({
      code: 'code-123',
      redirectUri: REDIRECT_URI,
      credentials: CREDENTIALS,
      fetchImpl,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(GoogleCalendarOAuthError)
    expect((error as Error).message).not.toContain('leak-me')
    expect((error as Error).message).not.toContain('invalid_grant')
  })

  it('rejects a partial grant that misses a required scope', async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          scope: 'https://www.googleapis.com/auth/calendar.events',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch

    await expect(
      exchangeGoogleCalendarOAuthCode({
        code: 'code-123',
        redirectUri: REDIRECT_URI,
        credentials: CREDENTIALS,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(GoogleCalendarOAuthError)
  })

  it('fails safely when Google does not return a refresh token', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ access_token: 'access-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch

    await expect(
      exchangeGoogleCalendarOAuthCode({
        code: 'code-123',
        redirectUri: REDIRECT_URI,
        credentials: CREDENTIALS,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(GoogleCalendarOAuthError)
  })

  it('maps a network failure to a safe error', async () => {
    const fetchImpl = (async () => {
      throw new Error('socket hang up')
    }) as typeof fetch

    await expect(
      exchangeGoogleCalendarOAuthCode({
        code: 'code-123',
        redirectUri: REDIRECT_URI,
        credentials: CREDENTIALS,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(GoogleCalendarOAuthError)
  })
})
