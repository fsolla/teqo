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
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const webServerPort = new URL(baseURL).port || (baseURL.startsWith('https:') ? '443' : '80')
const workersOverride = process.env.PLAYWRIGHT_WORKERS
const workers = workersOverride === undefined ? 2 : Number(workersOverride)
if (!Number.isInteger(workers) || workers < 2) {
  throw new Error('PLAYWRIGHT_WORKERS must be an integer of at least 2.')
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /setup\.e2e\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
    {
      name: 'campaign',
      testMatch: /campaign.*\.e2e\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
    {
      name: 'frontend',
      testMatch: /frontend\.e2e\.spec\.ts/,
      dependencies: ['campaign'],
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
    {
      name: 'admin',
      testMatch: /admin\.e2e\.spec\.ts/,
      dependencies: ['frontend'],
      fullyParallel: false,
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
    url: baseURL,
    /* Force the isolated test database into the server process. */
    env: {
      DATABASE_URL: process.env.DATABASE_URL as string,
      PORT: webServerPort,
      // A prior Playwright process can finish tearing down after the next starts.
      // Per-process output prevents that cleanup from deleting the active server's files.
      NEXT_DIST_DIR: `.next/e2e-${process.pid}`,
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? 'test-only-secret-not-used-in-production',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? baseURL,
    },
  },
})
