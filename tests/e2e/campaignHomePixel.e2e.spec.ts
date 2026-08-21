import type { APIRequestContext } from '@playwright/test'

import { adminHeaders } from '../helpers/adminApi'
import { seedTestUser } from '../helpers/seedUser'
import { expect, test } from './fixtures/e2eTest'

/**
 * S10 — the Meta pixel on the public campaign page: configured through
 * `SiteSettings.tracking.facebookPixelId` (admin REST), the home renders the
 * base code (inline `next/script` + `fbq` init) and nothing at all without a
 * configured ID (fail-closed). The external `fbevents.js` fetch is fulfilled
 * locally by the shared e2e guard (fixtures/e2eTest.ts), so no spec ever
 * depends on the Meta CDN; the base code itself is inline. The `Lead` wiring
 * (successful S9 capture → exactly one queued `fbq` Lead) is pinned by the
 * unit spec `campaignNewsletterLead.unit.spec.tsx` — a real submission here
 * would share the `campanha-novidades` consent key with the parallel
 * `campaignNewsletter` spec's purge/create lifecycle. Serial mode (precedent
 * `campaignNearestMunicipality`): the tests share one worker — a parallel
 * split would race two `seedTestUser` beforeAlls.
 */
test.describe.configure({ mode: 'serial' })

test.describe('Campaign home Meta pixel', () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  const runSuffix = Date.now()
  // Valid 15-digit numeric ID (same class the admin validation accepts).
  const PIXEL_ID = '123456789012345'

  // `_status: 'published'` publishes through the global's draft pipeline, same
  // pattern the frontend spec uses for versioned documents.
  const setSitePixel = async (
    request: APIRequestContext,
    headers: Record<string, string>,
    pixelId: string | null,
  ) => {
    // Insurance against the same-user concurrent-login session race with
    // specs that do NOT route their login through the advisory-locked
    // `adminHeaders` helper (e.g. the frontend spec's inline logins): a 403
    // means the session row was lost to another worker — re-login mints a
    // fresh one. The locked helper already serializes the specs that use it.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request.post(`${baseURL}/api/globals/site-settings`, {
        headers,
        data: { tracking: { facebookPixelId: pixelId }, _status: 'published' },
      })
      if (response.ok()) return
      if (response.status() === 403 && attempt === 0) {
        headers = await adminHeaders(request, baseURL)
        continue
      }
      throw new Error(`setSitePixel(${pixelId}) failed with ${response.status()}`)
    }
  }

  test.beforeAll(async ({ request }) => {
    await seedTestUser()
    // Self-healing lifecycle (S9 precedent): an aborted run could leave the
    // pixel behind and poison the fail-closed assertion — purge first.
    const headers = await adminHeaders(request, baseURL)
    await setSitePixel(request, headers, null)
  })

  test.afterAll(async ({ request }) => {
    const headers = await adminHeaders(request, baseURL).catch(() => undefined)
    if (headers) {
      await setSitePixel(request, headers, null)
    }
  })

  test('renders nothing without a configured pixel ID', async ({ page }) => {
    // Fresh load (unique query param misses every HTTP/router cache entry —
    // the content-section trick); the app ignores unknown params. The
    // fail-closed read comes from the global, which beforeAll just reset.
    await page.goto(`/?e2e=${runSuffix}-none`)
    await expect(page.locator('script[id^="meta-pixel-"]')).toHaveCount(0)
  })

  test('renders the base code when the site settings carry a valid ID', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request, baseURL)
    // The REST update busts `global_site-settings` via afterChange BEFORE the
    // goto, so the fresh render carries the pixel (deterministic, no cache race).
    await setSitePixel(request, headers, PIXEL_ID)
    await page.goto(`/?e2e=${runSuffix}-set`)

    const pixelScript = page.locator(`script#meta-pixel-${PIXEL_ID}`)
    await expect(pixelScript).toBeAttached()

    // The base code defines `window.fbq` synchronously (queue-based no-op
    // until fbevents.js processes it) — the seam `trackMetaLead` uses.
    await expect
      .poll(() => page.evaluate(() => typeof (window as { fbq?: unknown }).fbq === 'function'))
      .toBe(true)
  })
})
