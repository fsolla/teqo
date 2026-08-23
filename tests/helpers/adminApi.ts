import type { APIRequestContext } from '@playwright/test'

import { ADMIN_LOGIN_LOCK_KEY, withAdvisoryLock } from './advisoryLock'
import { testUser } from './seedUser'

/**
 * Logs the shared test user in and returns the `payload-token` cookie.
 *
 * Serialized by the Postgres advisory lock from `advisoryLock.ts` (see the
 * helper for the read-modify-write session class). The UI `login()` helper
 * shares the same lock key, so both login paths serialize against each other.
 */
export const adminHeaders = async (
  request: APIRequestContext,
  baseURL: string,
): Promise<Record<string, string>> =>
  withAdvisoryLock(ADMIN_LOGIN_LOCK_KEY, async () => {
    const login = await request.post(`${baseURL}/api/users/login`, {
      data: { email: testUser.email, password: testUser.password },
    })
    if (!login.ok()) {
      throw new Error(`admin login failed with ${login.status()}`)
    }
    const { token } = await login.json()
    return { cookie: `payload-token=${token}` }
  })
