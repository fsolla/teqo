import { Client } from 'pg'
import { afterAll, beforeAll } from 'vitest'

import { assertTestDatabase } from './assertTestDatabase'

/*
 * Arbitrary fixed key — every spec logs the shared test user
 * (`dev@payloadcms.com`) through this serialization point, so one key covers
 * the whole suite: the REST `adminHeaders` helper and the UI `login()` form
 * both acquire it. Single shared namespace on purpose (Postgres advisory
 * locks are global per database); if a second lock is ever needed, register
 * its key here instead of inventing an integer ad hoc.
 */
export const ADMIN_LOGIN_LOCK_KEY = 727_001

/**
 * C149 — `googleCalendarSync` is a SINGLETON row, and the int suite runs files
 * in parallel against one database: several google specs create/pick/delete
 * configured rows concurrently, and the loader's "configured row wins"
 * preference then resolves to ANOTHER file's row (channel/count assertions
 * read the wrong doc, snapshots land on a row being deleted). The lock
 * serializes the whole google calendar family for the duration of each file.
 */
export const GOOGLE_CALENDAR_SYNC_LOCK_KEY = 727_002

/**
 * Runs `fn` while holding a Postgres advisory lock.
 *
 * The class it serializes: Payload keeps auth sessions as a read-modify-write
 * array on the user document, so two parallel workers logging the same user
 * in concurrently can lose one session row — the loser's token then resolves
 * to nobody and every admin request answers 403. Test-only serialization;
 * never promote this to a production lock mechanism.
 */
export const withAdvisoryLock = async <T>(key: number, fn: () => Promise<T>): Promise<T> => {
  assertTestDatabase(process.env.DATABASE_URL)
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [key])
    return await fn()
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [key]).catch(() => {})
    await client.end().catch(() => {})
  }
}

/**
 * Holds the given advisory lock for the WHOLE spec file: `beforeAll` acquires
 * on a dedicated connection and `afterAll` releases it. Call at the top level
 * of a spec. A crashed worker drops its connection, releasing the lock.
 */
export const serializeSpecWithAdvisoryLock = (key: number): void => {
  let client: Client | null = null

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL)
    client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    await client.query('SELECT pg_advisory_lock($1)', [key])
  }, 60_000)

  afterAll(async () => {
    if (!client) return
    await client.query('SELECT pg_advisory_unlock($1)', [key]).catch(() => {})
    await client.end().catch(() => {})
    client = null
  })
}
