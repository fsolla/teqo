import type { APIRequestContext } from '@playwright/test'
import { Client } from 'pg'

import { testUser } from './seedUser'

// Arbitrary fixed key — every spec logs the same test user in through this
// helper, so one serialization point covers the whole suite.
const ADMIN_LOGIN_LOCK_KEY = 727_001

/**
 * Logs the shared test user in and returns the `payload-token` cookie.
 *
 * Serialized by a Postgres advisory lock: Payload keeps auth sessions as a
 * read-modify-write array on the user document (the campaign WebAuthn note
 * documents the exact class), so two parallel workers logging the same
 * `dev@payloadcms.com` in concurrently can lose one session row — the loser's
 * token then resolves to nobody and every admin request answers 403. The
 * lock makes the read-modify-write exclusive; a waiting worker logs in after
 * the winner, keeping every session.
 */
export const adminHeaders = async (
  request: APIRequestContext,
  baseURL: string,
): Promise<Record<string, string>> => {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADMIN_LOGIN_LOCK_KEY])
    const login = await request.post(`${baseURL}/api/users/login`, {
      data: { email: testUser.email, password: testUser.password },
    })
    if (!login.ok()) {
      throw new Error(`admin login failed with ${login.status()}`)
    }
    const { token } = await login.json()
    return { cookie: `payload-token=${token}` }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADMIN_LOGIN_LOCK_KEY]).catch(() => {})
    await client.end()
  }
}
