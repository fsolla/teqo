// @vitest-environment node
//
// C149 — the OAuth connection stored on the singleton `googleCalendarSync`
// row: recording, error state, disconnect, view/loader derivation. The int
// suite runs files in parallel against ONE shared database, so this file only
// creates CONNECTION-ONLY rows (no `calendarId`): the singleton loader prefers
// a configured row, which means these rows can never shadow the engine specs'
// configured row. Rows this file created are tracked and deleted; a token that
// landed on a shared row (the loader's preference) is cleared, never deleted.

import { getPayload, type Payload } from 'payload'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import {
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV,
  GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV,
} from '@/utilities/googleCalendarOAuth'
import {
  clearGoogleCalendarOAuthConnection,
  loadGoogleCalendarSyncConfig,
  readGoogleCalendarSyncView,
  recordGoogleCalendarOAuthConnection,
  recordGoogleCalendarOAuthError,
} from '@/utilities/googleCalendarSync'

import {
  GOOGLE_CALENDAR_SYNC_LOCK_KEY,
  serializeSpecWithAdvisoryLock,
} from '../helpers/advisoryLock'

serializeSpecWithAdvisoryLock(GOOGLE_CALENDAR_SYNC_LOCK_KEY)

let payload: Payload

/** Sets/restores the OAuth client pair around a callback — restored on failure too. */
const withGoogleCalendarOAuthClient = async <T>(run: () => Promise<T>): Promise<T> => {
  const previous = {
    id: process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV],
    secret: process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV],
  }
  process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV] = 'test-client-id'
  process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV] = 'test-client-secret'
  try {
    return await run()
  } finally {
    if (previous.id === undefined) delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV]
    else process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV] = previous.id
    if (previous.secret === undefined) delete process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV]
    else process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV] = previous.secret
  }
}

describe('C149 — OAuth connection on the googleCalendarSync row', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const ownedIds = new Set<number>()

  afterEach(async () => {
    // Clear connection fields this file wrote wherever they landed — the
    // loader may have picked a row created by a sibling spec, and that row
    // must not be deleted from under it.
    const touched = await payload.find({
      collection: 'googleCalendarSync',
      where: { oauthRefreshToken: { like: 'c149-conn%' } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    for (const doc of touched.docs) {
      if (ownedIds.has(doc.id)) continue
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
    for (const id of ownedIds) {
      await payload.delete({ collection: 'googleCalendarSync', id, overrideAccess: true })
    }
    ownedIds.clear()
  })

  const createConnectionRow = async (data: Record<string, unknown> = {}) => {
    const doc = await payload.create({
      collection: 'googleCalendarSync',
      data,
      depth: 0,
      overrideAccess: true,
    })
    ownedIds.add(doc.id)
    return doc
  }

  it('records the connection (create when no row exists) and clears previous errors', async () => {
    await createConnectionRow({ oauthErrorAt: '2026-08-11T10:00:00.000Z', oauthError: 'antigo' })

    await recordGoogleCalendarOAuthConnection(payload, {
      refreshToken: 'c149-conn-create',
      scope: 'scope-a scope-b',
    })

    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.oauthRefreshToken).toBe('c149-conn-create')
    expect(doc?.oauthScope).toBe('scope-a scope-b')
    expect(doc?.oauthConnectedAt).toBeTruthy()
    expect(doc?.oauthErrorAt).toBeNull()
    expect(doc?.oauthError).toBeNull()
  })

  it('records the auth error and clears the whole connection on disconnect', async () => {
    await createConnectionRow({ oauthRefreshToken: 'c149-conn-disconnect' })

    await recordGoogleCalendarOAuthError(payload, 'A conexão com o Google expirou.')

    let doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.oauthError).toBe('A conexão com o Google expirou.')
    expect(doc?.oauthErrorAt).toBeTruthy()

    await clearGoogleCalendarOAuthConnection(payload)

    doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.oauthRefreshToken).toBeNull()
    expect(doc?.oauthScope).toBeNull()
    expect(doc?.oauthConnectedAt).toBeNull()
    expect(doc?.oauthErrorAt).toBeNull()
    expect(doc?.oauthError).toBeNull()
  })

  it('derives the connection view (connected → error) and oauthAvailable from the env', async () => {
    await createConnectionRow({ oauthRefreshToken: 'c149-conn-view' })

    await withGoogleCalendarOAuthClient(async () => {
      const connected = await readGoogleCalendarSyncView(payload)
      expect(connected.connection).toBe('connected')
      expect(connected.oauthAvailable).toBe(true)

      await recordGoogleCalendarOAuthError(payload, 'Token revogado.')

      const broken = await readGoogleCalendarSyncView(payload)
      expect(broken.connection).toBe('error')
      expect(broken.oauthError).toBe('Token revogado.')
    })
  })

  it('finds a connection-only row even without a calendarId (fresh setup)', async () => {
    const row = await createConnectionRow({ oauthRefreshToken: 'c149-conn-loader' })

    const loaded = await loadGoogleCalendarSyncConfig(payload)
    // A configured sibling (parallel spec) legitimately wins the singleton
    // preference; without one, the connection-only row is the row.
    if (loaded?.calendarId) {
      expect(loaded.id).not.toBe(row.id)
    } else {
      expect(loaded?.id).toBe(row.id)
    }
    expect(row.calendarId ?? null).toBeNull()
  })
})
