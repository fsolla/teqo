import type { APIRequestContext } from '@playwright/test'
import { test as base, expect, request as playwrightRequest } from '@playwright/test'

import { campaignFixture, type CampaignE2EFixture } from './campaignE2EFixtures.js'

/**
 * Browserless full-stack e2e base (OPS35): same job, same server, same
 * database, real HTTP — no browser ever launches.
 *
 * Deliberately extends the RAW `@playwright/test` test, not `e2eTest.ts`:
 * `e2eFailureGuard` is `auto: true` and would pull the `page`/`context`
 * fixtures, launching a browser in every spec. The client-failure guard stays
 * exclusive to browser specs — the HTTP mode does not pretend to observe what
 * it cannot see (intention OPS35).
 *
 * The `campaign` fixture is the shared one from the browser suite (ownership,
 * in-process Payload, cleanup) — fixtures are created the same way, no
 * parallel seeding path.
 */

// Same stable contract `setCampaignAuthCookie` writes
// (src/utilities/campaignAuth.ts:12) — the module is `server-only` and cannot
// be imported from the test process (precedent: tests/unit/campaignLoginAction.unit.spec.ts:27).
const CAMPAIGN_TOKEN_COOKIE = 'campaign-token'
const CAMPAIGN_COOKIE_PATH = '/campanha'

type CampaignRequestLogin = (
  user: { email?: string | null; username?: string | null },
  password: string,
) => Promise<APIRequestContext>

type CampaignHttpTestFixtures = {
  campaign: CampaignE2EFixture
  campaignRequest: CampaignRequestLogin
}

/**
 * Authenticates through the app's real login endpoint (Payload REST
 * `loginOperation` — the same operation `loginCampaign` calls) and returns a
 * request context carrying the canonical `campaign-token` cookie scoped to
 * `/campanha`, mirroring `setCampaignAuthCookie`'s options. No browser, no
 * duplicated auth logic, no re-signed TTL: the REST login returns the
 * configured 14-day token, which is more than enough for a test session.
 */
const loginCampaignRequest = async (
  baseURL: string,
  user: { email?: string | null; username?: string | null },
  password: string,
): Promise<{ token: string; user: { id: number | string } }> => {
  const loginContext = await playwrightRequest.newContext({ baseURL })
  try {
    const body =
      user.email !== undefined && user.email !== null
        ? { email: user.email, password }
        : { username: user.username ?? '', password }
    const login = await loginContext.post('/api/campaignUser/login', { data: body })
    if (!login.ok()) {
      throw new Error(
        `Campaign REST login failed: ${login.status()} ${(await login.text()).slice(0, 300)}`,
      )
    }
    return (await login.json()) as { token: string; user: { id: number | string } }
  } finally {
    await loginContext.dispose()
  }
}

const campaignTokenStorageState = (baseURL: string, token: string) => {
  const url = new URL(baseURL)
  return {
    cookies: [
      {
        name: CAMPAIGN_TOKEN_COOKIE,
        value: token,
        domain: url.hostname,
        path: CAMPAIGN_COOKIE_PATH,
        expires: -1,
        httpOnly: true,
        secure: url.protocol === 'https:',
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  }
}

export const test = base.extend<CampaignHttpTestFixtures>({
  campaign: campaignFixture,
  // Array form (same as `e2eTest.ts`'s guard): the shorthand property names
  // the function `campaignRequest`, which trips the react-hooks rule on the
  // fixture's `use(...)` callback. Factory-created contexts are not
  // auto-disposed by Playwright; the per-test closure tracks them and
  // disposes them at teardown.
  campaignRequest: [
    async ({ campaign }, use) => {
      const contexts: APIRequestContext[] = []
      await use(async (user, password) => {
        const { token } = await loginCampaignRequest(campaign.baseURL, user, password)
        const context = await playwrightRequest.newContext({
          baseURL: campaign.baseURL,
          storageState: campaignTokenStorageState(campaign.baseURL, token),
        })
        contexts.push(context)
        return context
      })
      await Promise.all(contexts.map((context) => context.dispose()))
    },
    {},
  ],
})

export { expect }
