import type { APIRequestContext } from '@playwright/test'

import { seedTestUser, testUser } from '../helpers/seedUser'
import { expect, test } from './fixtures/e2eTest'

/**
 * S10 — the Meta pixel on the public campaign page: configured through
 * `SiteSettings.tracking.facebookPixelId` (admin REST), the home renders the
 * base code (inline `next/script` + `fbq` init) and nothing at all without a
 * configured ID (fail-closed). The external `fbevents.js` fetch is stubbed so
 * the spec never depends on the Meta CDN; the base code itself is inline.
 * Serial mode (precedent `campaignNearestMunicipality`): the two tests share
 * one worker — a parallel split would race two `seedTestUser` beforeAlls.
 */
test.describe.configure({ mode: 'serial' })

test.describe('Campaign home Meta pixel', () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  const runSuffix = Date.now()
  // Valid 15-digit numeric ID (same class the admin validation accepts).
  const PIXEL_ID = '123456789012345'

  const adminHeaders = async (request: APIRequestContext): Promise<Record<string, string>> => {
    const login = await request.post(`${baseURL}/api/users/login`, {
      data: { email: testUser.email, password: testUser.password },
    })
    expect(login.ok()).toBeTruthy()
    const { token } = await login.json()
    return { cookie: `payload-token=${token}` }
  }

  // `_status: 'published'` publishes through the global's draft pipeline, same
  // pattern the frontend spec uses for versioned documents.
  const setSitePixel = async (
    request: APIRequestContext,
    headers: Record<string, string>,
    pixelId: string | null,
  ) => {
    const response = await request.post(`${baseURL}/api/globals/site-settings`, {
      headers,
      data: { tracking: { facebookPixelId: pixelId }, _status: 'published' },
    })
    expect(response.ok()).toBeTruthy()
  }

  test.beforeAll(async ({ request }) => {
    await seedTestUser()
    // Self-healing lifecycle (S9 precedent): an aborted run could leave the
    // pixel behind and poison the fail-closed assertion — purge first.
    const headers = await adminHeaders(request)
    await setSitePixel(request, headers, null)
  })

  test.afterAll(async ({ request }) => {
    const headers = await adminHeaders(request).catch(() => undefined)
    if (headers) {
      await setSitePixel(request, headers, null)
    }
  })

  test('renders nothing without a configured pixel ID', async ({ page }) => {
    // Fresh load (unique query param bypasses the ISR fetch cache, same trick
    // as the content-section specs); the app ignores unknown params.
    await page.goto(`/?e2e=${runSuffix}-none`)
    await expect(page.locator('script[id^="meta-pixel-"]')).toHaveCount(0)
  })

  test('renders the Meta base code when the site settings carry a valid ID', async ({
    page,
    request,
  }) => {
    const headers = await adminHeaders(request)
    await setSitePixel(request, headers, PIXEL_ID)

    // The inline base code always runs; only the external fbevents.js fetch is
    // stubbed, so the assertion never depends on the Meta CDN.
    await page.route('https://connect.facebook.net/**', (route) =>
      route.fulfill({ body: '', contentType: 'application/javascript' }),
    )
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
