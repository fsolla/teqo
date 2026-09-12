// @vitest-environment node
//
// C149 — the OAuth handshake boundary: the start action (role + state cookie
// + authorize URL) and the callback route (state validation, role re-check,
// code exchange, connection recording). `next/headers` is mocked with an
// in-memory cookie jar so the real signing/verification runs; `fetch` is
// stubbed at the token endpoint so no request leaves the process. Session
// resolution is mocked (the pattern of googleCalendarSyncAction.int.spec.ts);
// everything else — Payload access, the engine hooks, the DB — runs for real.

import { NextRequest } from 'next/server'
import { getPayload, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'

const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value)
    },
  }),
  headers: async () => new Headers(),
}))

vi.mock('@/utilities/campaignActionContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utilities/campaignActionContext')>()
  return { ...original, getCampaignActionContext: vi.fn() }
})

// The callback's follow-up reconciliation is not this spec's subject (the
// engine has its own file) and, against the shared singleton, a full pass
// would write snapshots onto whichever row the loader picked — including a
// parallel spec's. Stub only that call; every other export stays real.
vi.mock('@/utilities/googleCalendarSync', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utilities/googleCalendarSync')>()
  return { ...original, runCampaignCalendarSync: vi.fn() }
})

import {
  disconnectGoogleCalendarOAuth,
  startGoogleCalendarOAuth,
} from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import { GET as googleOAuthCallback } from '@/app/(campaign)/campanha/agenda/google-oauth/callback/route'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import {
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV,
  GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV,
} from '@/utilities/googleCalendarOAuth'
import { recordGoogleCalendarOAuthConnection } from '@/utilities/googleCalendarSync'

import {
  GOOGLE_CALENDAR_SYNC_LOCK_KEY,
  serializeSpecWithAdvisoryLock,
} from '../helpers/advisoryLock'
import { installCampaignFixtures } from '../helpers/campaignFixtures'

serializeSpecWithAdvisoryLock(GOOGLE_CALENDAR_SYNC_LOCK_KEY)

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const mockedGetContext = vi.mocked(getCampaignActionContext)

const OAUTH_ENV_KEYS = [
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV,
  GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV,
] as const
const originalEnv = new Map(OAUTH_ENV_KEYS.map((key) => [key, process.env[key]]))

const setOAuthClientEnv = (): void => {
  process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV] = 'test-client-id'
  process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV] = 'test-client-secret'
}

const restoreEnv = (): void => {
  for (const key of OAUTH_ENV_KEYS) {
    const value = originalEnv.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

/**
 * Token endpoint + an empty calendar API, so the callback's follow-up pass
 * completes without network regardless of which row the loader picked.
 */
const googleFetchStub = (refreshToken: string): typeof fetch =>
  (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: refreshToken,
          scope:
            'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (url.includes('/events/watch')) {
      return new Response(
        JSON.stringify({ id: 'watch-1', resourceId: 'resource-1', expiration: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (url.includes('/channels/stop')) return new Response(null, { status: 204 })
    if (url.includes('/calendar/v3/')) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error(`Unexpected fetch to ${url}`)
  }) as typeof fetch

const callbackRequest = (params: Record<string, string>): NextRequest =>
  new NextRequest(
    `http://localhost:3000/campanha/agenda/google-oauth/callback?${new URLSearchParams(params).toString()}`,
  )

const rowsWithToken = (token: string) =>
  payload.find({
    collection: 'googleCalendarSync',
    where: { oauthRefreshToken: { equals: token } },
    depth: 0,
    overrideAccess: true,
  })

describe('C149 — OAuth actions and callback', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterEach(async () => {
    restoreEnv()
    cookieJar.clear()
    vi.unstubAllGlobals()
    vi.clearAllMocks()

    // The connection may have landed on a parallel spec's row (the loader
    // prefers a configured row): clear the fields, never delete that row.
    const touched = await payload.find({
      collection: 'googleCalendarSync',
      where: { oauthRefreshToken: { like: 'c149-refresh%' } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    for (const doc of touched.docs) {
      await payload.update({
        collection: 'googleCalendarSync',
        id: doc.id,
        data: {
          oauthRefreshToken: null,
          oauthScope: null,
          oauthConnectedAt: null,
          oauthErrorAt: null,
          oauthError: null,
        },
        depth: 0,
        overrideAccess: true,
      })
    }
    // Empty rows (no calendar, no token) are only produced by this file's
    // start attempts — safe to delete.
    const emptyRows = await payload.find({
      collection: 'googleCalendarSync',
      where: {
        and: [{ calendarId: { exists: false } }, { oauthRefreshToken: { exists: false } }],
      },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    for (const doc of emptyRows.docs) {
      await payload.delete({ collection: 'googleCalendarSync', id: doc.id, overrideAccess: true })
    }
  })

  afterAll(() => {
    restoreEnv()
  })

  it('start (coordinator) returns the consent URL and the callback records the connection', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    mockedGetContext.mockResolvedValue({ payload, actor: coordinator })
    setOAuthClientEnv()

    const start = await startGoogleCalendarOAuth()
    expect(start.ok).toBe(true)
    if (!start.ok) throw new Error('start must succeed')

    const authorizeUrl = new URL(start.authorizeUrl)
    expect(`${authorizeUrl.origin}${authorizeUrl.pathname}`).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    )
    expect(authorizeUrl.searchParams.get('access_type')).toBe('offline')
    expect(authorizeUrl.searchParams.get('prompt')).toBe('consent')
    expect(authorizeUrl.searchParams.get('redirect_uri')).toMatch(
      /\/campanha\/agenda\/google-oauth\/callback$/,
    )
    const state = authorizeUrl.searchParams.get('state')
    expect(state).toBeTruthy()
    expect(cookieJar.has('campaign-google-oauth-state')).toBe(true)

    const refreshToken = 'c149-refresh-callback-success'
    vi.stubGlobal('fetch', googleFetchStub(refreshToken))

    const response = await googleOAuthCallback(
      callbackRequest({ code: 'code-1', state: state as string }),
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/campanha/agenda')

    const rows = await rowsWithToken(refreshToken)
    expect(rows.docs).toHaveLength(1)
    expect(rows.docs[0]?.oauthConnectedAt).toBeTruthy()
    // The state cookie is single-use.
    expect(cookieJar.get('campaign-google-oauth-state')).toBe('')
  })

  it('start refuses an advisor without writing anything', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    mockedGetContext.mockResolvedValue({ payload, actor: advisor })
    setOAuthClientEnv()

    const start = await startGoogleCalendarOAuth()

    expect(start.ok).toBe(false)
    if (start.ok) throw new Error('start must be refused')
    expect(start.message).toContain('candidato ou coordenação')
    expect(cookieJar.has('campaign-google-oauth-state')).toBe(false)
  })

  it('start fails closed when the OAuth client env is missing', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    mockedGetContext.mockResolvedValue({ payload, actor: coordinator })
    delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV]
    delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV]

    const start = await startGoogleCalendarOAuth()

    expect(start.ok).toBe(false)
    if (start.ok) throw new Error('start must fail')
    expect(start.message).toContain('não está configurada no servidor')
  })

  it('callback refuses an invalid state without recording anything', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    mockedGetContext.mockResolvedValue({ payload, actor: coordinator })
    setOAuthClientEnv()
    vi.stubGlobal('fetch', googleFetchStub('c149-refresh-should-not-exist'))

    const response = await googleOAuthCallback(
      callbackRequest({ code: 'code-1', state: 'forged-state' }),
    )

    expect(response.status).toBe(307)
    expect((await rowsWithToken('c149-refresh-should-not-exist')).docs).toHaveLength(0)
  })

  it('callback treats access_denied as a silent redirect', async () => {
    const response = await googleOAuthCallback(callbackRequest({ error: 'access_denied' }))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/campanha/agenda')
  })

  it('disconnect clears the stored connection', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    mockedGetContext.mockResolvedValue({ payload, actor: coordinator })
    setOAuthClientEnv()

    const refreshToken = 'c149-refresh-disconnect'
    await recordGoogleCalendarOAuthConnection(payload, { refreshToken, scope: null })
    expect((await rowsWithToken(refreshToken)).docs).toHaveLength(1)

    const result = await disconnectGoogleCalendarOAuth()

    expect(result.ok).toBe(true)
    expect((await rowsWithToken(refreshToken)).docs).toHaveLength(0)
  })
})
