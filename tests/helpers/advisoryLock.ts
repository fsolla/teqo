import { Client } from 'pg'

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
 * read the wrong doc, snapshots land on a row being deleted). Serialize the
 * whole google calendar family for the duration of each file with
 * `serializeGoogleCalendarSyncSpec` (`tests/helpers/googleCalendarSyncLock.ts`
 * — the vitest hooks live there so this module stays loadable by Playwright
 * fixtures, which must never pull `vitest` into the e2e process).
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
 * Acquires the lock on a dedicated connection and returns the release
 * function. The caller owns the lifetime (a spec file holds it between its
 * `beforeAll` and `afterAll`); a crashed worker drops the connection and the
 * lock is released by Postgres.
 */
export const acquireAdvisoryLock = async (key: number): Promise<() => Promise<void>> => {
  assertTestDatabase(process.env.DATABASE_URL)
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query('SELECT pg_advisory_lock($1)', [key])
  return async () => {
    await client.query('SELECT pg_advisory_unlock($1)', [key]).catch(() => {})
    await client.end().catch(() => {})
  }
}
