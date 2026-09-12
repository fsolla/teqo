import { afterEach, describe, expect, it } from 'vitest'

import type { Activity, GoogleCalendarSync as GoogleCalendarSyncDoc } from '@/payload-types'

import {
  GoogleCalendarApiError,
  GoogleCalendarAuthError,
  REQUEST_TIMEOUT_MS,
} from '@/utilities/googleCalendarClient'
import {
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV,
  GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV,
} from '@/utilities/googleCalendarOAuth'
import {
  deriveGoogleCalendarConnectionStatus,
  deriveGoogleCalendarSyncStatus,
  GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV,
  GOOGLE_CALENDAR_SYNC_HOOK_TIMEOUT_MS,
  oauthErrorPatchFor,
  readGoogleCalendarAuth,
  readGoogleServiceAccountCredentials,
  shouldSyncActivityOperation,
  shouldSyncConfigChange,
} from '@/utilities/googleCalendarSync'

describe('deriveGoogleCalendarSyncStatus', () => {
  const configured = { hasCredential: true, calendarId: 'c_abc@group.calendar.google.com' }

  it('is not-configured without credential or calendar id (fail-closed)', () => {
    expect(deriveGoogleCalendarSyncStatus({ hasCredential: false, calendarId: null })).toBe(
      'not-configured',
    )
    expect(deriveGoogleCalendarSyncStatus({ hasCredential: true, calendarId: null })).toBe(
      'not-configured',
    )
    expect(deriveGoogleCalendarSyncStatus({ hasCredential: false, calendarId: 'x' })).toBe(
      'not-configured',
    )
  })

  it('is disabled while disabledAt is set', () => {
    expect(
      deriveGoogleCalendarSyncStatus({ ...configured, disabledAt: '2026-08-11T10:00:00.000Z' }),
    ).toBe('disabled')
  })

  it('is paused while the last attempt failed', () => {
    expect(
      deriveGoogleCalendarSyncStatus({
        ...configured,
        lastSuccessAt: '2026-08-11T09:00:00.000Z',
        lastErrorAt: '2026-08-11T10:00:00.000Z',
      }),
    ).toBe('paused')
    expect(
      deriveGoogleCalendarSyncStatus({
        ...configured,
        lastErrorAt: '2026-08-11T10:00:00.000Z',
      }),
    ).toBe('paused')
  })

  it('recovers to synced after the last success', () => {
    expect(
      deriveGoogleCalendarSyncStatus({
        ...configured,
        lastSuccessAt: '2026-08-11T10:30:00.000Z',
        lastErrorAt: '2026-08-11T10:00:00.000Z',
      }),
    ).toBe('synced')
    expect(deriveGoogleCalendarSyncStatus(configured)).toBe('synced')
  })
})

describe('deriveGoogleCalendarConnectionStatus (C149)', () => {
  it('is not-configured without a refresh token and without an error', () => {
    expect(deriveGoogleCalendarConnectionStatus({ hasRefreshToken: false })).toBe('not-configured')
  })

  it('is connected with a refresh token and no newer error', () => {
    expect(
      deriveGoogleCalendarConnectionStatus({
        hasRefreshToken: true,
        oauthConnectedAt: '2026-08-11T10:00:00.000Z',
      }),
    ).toBe('connected')
    // An error recorded BEFORE the last connection is stale — connected wins.
    expect(
      deriveGoogleCalendarConnectionStatus({
        hasRefreshToken: true,
        oauthConnectedAt: '2026-08-11T12:00:00.000Z',
        oauthErrorAt: '2026-08-11T10:00:00.000Z',
      }),
    ).toBe('connected')
  })

  it('is error when the auth error is newer than the connection (or there is none)', () => {
    expect(
      deriveGoogleCalendarConnectionStatus({
        hasRefreshToken: true,
        oauthConnectedAt: '2026-08-11T10:00:00.000Z',
        oauthErrorAt: '2026-08-11T12:00:00.000Z',
      }),
    ).toBe('error')
    // A failed handshake before the first connection has no connectedAt.
    expect(
      deriveGoogleCalendarConnectionStatus({
        hasRefreshToken: false,
        oauthErrorAt: '2026-08-11T12:00:00.000Z',
      }),
    ).toBe('error')
  })
})

describe('oauthErrorPatchFor (C149)', () => {
  it('maps a dead OAuth connection to the connection error fields', () => {
    expect(
      oauthErrorPatchFor(
        new GoogleCalendarAuthError('A conexão com o Google expirou. Reconecte a conta.'),
        '2026-09-12T10:00:00.000Z',
      ),
    ).toEqual({
      oauthErrorAt: '2026-09-12T10:00:00.000Z',
      oauthError: 'A conexão com o Google expirou. Reconecte a conta.',
    })
  })

  it('leaves every other failure out of the connection state', () => {
    expect(oauthErrorPatchFor(new Error('HTTP 500'), 'at')).toBeNull()
    expect(oauthErrorPatchFor(new GoogleCalendarApiError('HTTP 403', 403), 'at')).toBeNull()
    expect(oauthErrorPatchFor('not-an-error', 'at')).toBeNull()
  })

  it('truncates the message to the stored 500-char limit', () => {
    const patch = oauthErrorPatchFor(new GoogleCalendarAuthError('x'.repeat(900)), 'at')
    expect(patch?.oauthError).toHaveLength(500)
  })
})

describe('readGoogleServiceAccountCredentials', () => {
  const originalKey = process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV]

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV]
    } else {
      process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = originalKey
    }
  })

  it('parses the base64 JSON key into credentials', () => {
    const payload = {
      client_email: 'teqo-sa@projeto.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
    }
    process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = Buffer.from(
      JSON.stringify(payload),
      'utf8',
    ).toString('base64')

    expect(readGoogleServiceAccountCredentials()).toEqual({
      clientEmail: payload.client_email,
      privateKey: payload.private_key,
    })
  })

  it('returns null when the env is absent or malformed (fail-closed)', () => {
    delete process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV]
    expect(readGoogleServiceAccountCredentials()).toBeNull()

    process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = 'not-base64-json'
    expect(readGoogleServiceAccountCredentials()).toBeNull()

    process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = Buffer.from(
      JSON.stringify({ client_email: 'x' }),
      'utf8',
    ).toString('base64')
    expect(readGoogleServiceAccountCredentials()).toBeNull()
  })
})

describe('readGoogleCalendarAuth (C149)', () => {
  const original = {
    sa: process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV],
    id: process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV],
    secret: process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV],
  }

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    restore(GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV, original.sa)
    restore(GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV, original.id)
    restore(GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV, original.secret)
  })

  const setServiceAccountEnv = () => {
    process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = Buffer.from(
      JSON.stringify({
        client_email: 'teqo-sa@projeto.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
      }),
      'utf8',
    ).toString('base64')
  }

  const setOAuthClientEnv = () => {
    process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV] = 'client-id'
    process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV] = 'client-secret'
  }

  const doc = (overrides: Record<string, unknown> = {}) =>
    ({ id: 1, ...overrides }) as unknown as GoogleCalendarSyncDoc

  it('prefers the OAuth connection over the service account', () => {
    setServiceAccountEnv()
    setOAuthClientEnv()

    const auth = readGoogleCalendarAuth(doc({ oauthRefreshToken: 'refresh-token' }))

    expect(auth).toEqual({
      kind: 'oauth',
      credentials: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
      },
    })
  })

  it('falls back to the service account without a refresh token', () => {
    setServiceAccountEnv()
    setOAuthClientEnv()

    const auth = readGoogleCalendarAuth(doc())

    expect(auth?.kind).toBe('service-account')
  })

  it('falls back to the service account when the OAuth client env is missing', () => {
    setServiceAccountEnv()
    delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV]
    delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV]

    expect(readGoogleCalendarAuth(doc({ oauthRefreshToken: 'refresh-token' }))?.kind).toBe(
      'service-account',
    )
  })

  it('is null (fail-closed) without any credential', () => {
    delete process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV]
    delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV]
    delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV]

    expect(readGoogleCalendarAuth(doc({ oauthRefreshToken: 'refresh-token' }))).toBeNull()
    expect(readGoogleCalendarAuth(null)).toBeNull()
  })
})

describe('shouldSyncActivityOperation', () => {
  const activity = (overrides: Record<string, unknown> = {}) =>
    ({ id: 1, title: 'Caminhada', status: 'confirmado', ...overrides }) as unknown as Activity

  it('always syncs on create and delete', () => {
    expect(shouldSyncActivityOperation({ operation: 'create', doc: activity() })).toBe(true)
    expect(shouldSyncActivityOperation({ operation: 'delete', doc: activity() })).toBe(true)
  })

  it('skips updates that only touch non-mirrored fields (tasks, derived state)', () => {
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ tasks: [{ title: 'Novo' }], taskDoneCount: 1 }),
        previousDoc: activity({ tasks: [{ title: 'Antigo' }], taskDoneCount: 0 }),
      }),
    ).toBe(false)
  })

  it.each([
    'title',
    'status',
    'startAt',
    'endAt',
    'allDay',
    'locality',
    'tags',
    'deputyPresent',
  ] as const)('syncs when the mirrored field %s changed', (field) => {
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ [field]: 'changed' }),
        previousDoc: activity({ [field]: 'original' }),
      }),
    ).toBe(true)
  })

  it('syncs when the municipality relationship changed', () => {
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ municipality: 2 }),
        previousDoc: activity({ municipality: 1 }),
      }),
    ).toBe(true)
  })

  it('does NOT sync when only non-mirrored fields changed (tasks, description, updates, result)', () => {
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ description: 'novo texto', tasks: [{ title: 'Nova tarefa' }] }),
        previousDoc: activity({ description: 'texto antigo', tasks: [{ title: 'Antiga' }] }),
      }),
    ).toBe(false)
  })

  it('normalizes populated vs depth-0 relationship shapes (afterChange doc vs previousDoc)', () => {
    // The afterChange `doc` carries the populated municipality object; the
    // `previousDoc` is loaded depth-0 (numeric id) — same id must NOT change.
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ municipality: { id: 7, name: 'Salvador' } }),
        previousDoc: activity({ municipality: 7 }),
      }),
    ).toBe(false)
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ tags: ['B', 'A'] }),
        previousDoc: activity({ tags: ['A', 'B'] }),
      }),
    ).toBe(false)
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ tags: ['A'] }),
        previousDoc: activity({ tags: ['B'] }),
      }),
    ).toBe(true)
  })
})

describe('shouldSyncConfigChange', () => {
  const config = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 1,
      calendarId: 'c_a@group.calendar.google.com',
      ...overrides,
    }) as unknown as GoogleCalendarSyncDoc

  it('always syncs on create', () => {
    expect(shouldSyncConfigChange({ operation: 'create', doc: config() })).toBe(true)
  })

  it('skips state-only writes (engine recording outcomes) — no re-entry loop', () => {
    expect(
      shouldSyncConfigChange({
        operation: 'update',
        doc: config({ lastSyncedAt: '2026-08-11T10:00:00.000Z', lastSuccessAt: 'x' }),
        previousDoc: config(),
      }),
    ).toBe(false)
  })

  it('skips disabling (no sync needed while off)', () => {
    expect(
      shouldSyncConfigChange({
        operation: 'update',
        doc: config({ disabledAt: '2026-08-11T10:00:00.000Z' }),
        previousDoc: config(),
      }),
    ).toBe(false)
  })

  it('syncs when the calendarId changed (reconcile into the new calendar)', () => {
    expect(
      shouldSyncConfigChange({
        operation: 'update',
        doc: config({ calendarId: 'c_b@group.calendar.google.com' }),
        previousDoc: config(),
      }),
    ).toBe(true)
  })

  it('syncs when re-enabled (disabledAt cleared)', () => {
    expect(
      shouldSyncConfigChange({
        operation: 'update',
        doc: config(),
        previousDoc: config({ disabledAt: '2026-08-11T10:00:00.000Z' }),
      }),
    ).toBe(true)
  })

  it('skips OAuth-connection writes — the callback runs its own pass (C149)', () => {
    expect(
      shouldSyncConfigChange({
        operation: 'update',
        doc: config({
          oauthRefreshToken: 'refresh-token',
          oauthConnectedAt: 'x',
          oauthError: null,
        }),
        previousDoc: config({ oauthRefreshToken: null }),
      }),
    ).toBe(false)
  })
})

describe('sync deadlines (C114-LOCK)', () => {
  it('keeps the hook deadline strictly below the per-hop deadline (row lock window)', () => {
    // The hook fetch runs inside the save's transaction — its deadline bounds
    // the row lock window; manual / webhook holds no lock and keeps 15s headroom.
    expect(GOOGLE_CALENDAR_SYNC_HOOK_TIMEOUT_MS).toBe(5_000)
    expect(GOOGLE_CALENDAR_SYNC_HOOK_TIMEOUT_MS).toBeLessThan(REQUEST_TIMEOUT_MS)
  })
})
