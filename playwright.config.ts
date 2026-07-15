import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

import { assertTestDatabase } from './tests/helpers/assertTestDatabase'

/**
 * e2e tests boot a real dev server that seeds/deletes records, so they must run
 * against the isolated test database — never .env / .env.local (production).
 * `override: true` guarantees the test DB wins over anything in the shell.
 */
loadEnv({ path: '.env.test', override: true })
assertTestDatabase(process.env.DATABASE_URL)

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    /*
     * Never reuse a dev server a developer may already have running against the
     * production database — always start a fresh one bound to the test DB.
     */
    reuseExistingServer: false,
    url: 'http://localhost:3000',
    /* Force the isolated test database into the server process. */
    env: {
      DATABASE_URL: process.env.DATABASE_URL as string,
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? 'test-only-secret-not-used-in-production',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    },
  },
})
