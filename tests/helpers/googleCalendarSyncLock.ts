import { afterAll, beforeAll } from 'vitest'

import { acquireAdvisoryLock, GOOGLE_CALENDAR_SYNC_LOCK_KEY } from './advisoryLock'

/**
 * C149 — holds the google-calendar advisory lock for the WHOLE spec file
 * (`beforeAll` acquires on a dedicated connection, `afterAll` releases it).
 * Call at the top level of every int spec that touches the singleton
 * `googleCalendarSync` row so parallel files cannot read/write each other's
 * configured row.
 *
 * This module imports vitest hooks ON PURPOSE and must only be imported by
 * int specs: `tests/helpers/advisoryLock.ts` is also loaded by Playwright
 * fixtures, and pulling `vitest` into the e2e process breaks its matchers
 * (`Cannot redefine property: Symbol($$jest-matchers-object)`).
 */
export const serializeGoogleCalendarSyncSpec = (): void => {
  let release: (() => Promise<void>) | null = null

  beforeAll(async () => {
    release = await acquireAdvisoryLock(GOOGLE_CALENDAR_SYNC_LOCK_KEY)
  }, 60_000)

  afterAll(async () => {
    if (!release) return
    await release()
    release = null
  })
}
