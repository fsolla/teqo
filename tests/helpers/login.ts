import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { ADMIN_LOGIN_LOCK_KEY, withAdvisoryLock } from './advisoryLock'

export interface LoginOptions {
  page: Page
  serverURL?: string
  user: {
    email: string
    password: string
  }
}

/**
 * Logs the user into the admin panel via the login page.
 *
 * Serialized by the Postgres advisory lock from `advisoryLock.ts` (same key
 * the REST `adminHeaders` helper uses) — the UI form mutates the same
 * read-modify-write session array, so a parallel worker logging via
 * `adminHeaders` concurrently could lose one session row → 403.
 */
export async function login({
  page,
  serverURL = 'http://localhost:3000',
  user,
}: LoginOptions): Promise<void> {
  await page.goto(`${serverURL}/admin/login`)

  await withAdvisoryLock(ADMIN_LOGIN_LOCK_KEY, async () => {
    await page.fill('#field-email', user.email)
    await page.fill('#field-password', user.password)
    await page.click('button[type="submit"]')

    await page.waitForURL(`${serverURL}/admin`)

    const dashboardArtifact = page.getByRole('heading', { name: 'Coleções', exact: true })
    await expect(dashboardArtifact).toBeVisible()
  })
}
