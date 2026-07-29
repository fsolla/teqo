import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

import { assertTestDatabase } from './tests/helpers/assertTestDatabase'

/**
 * e2e tests boot a real dev server that seeds/deletes records, so they must run
 * against the isolated test database — never .env / .env.local (production).
 * `override: true` guarantees the test DB wins over anything in the shell.
 */
loadEnv({ path: '.env.test', override: true })

// Optional local override when the default Docker port is occupied (e.g. mapped
// to 5433) — same escape hatch vitest.setup.ts documents.
if (process.env.TEQO_TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEQO_TEST_DATABASE_URL
}

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
  /*
   * The 30 s default does not cover a whole journey (login + several dev-mode
   * RSC navigations) when the dev server compiles cold under load — measured
   * during P3-C: login's waitForURL blew the budget with the machine at load
   * ~7. 60 s covers cold-compile journeys without masking real hangs.
   */
  timeout: 60_000,
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
  expect: {
    /*
     * The default 5 s does not cover a dev-mode RSC round-trip on the heavy
     * campaign list routes once the machine is loaded (B17 measured this: the
     * failing set drifted with load average, and the picker's own specs pass
     * only with their own budgets). 10 s covers the cold dev compile without
     * masking real regressions for a whole suite run.
     */
    timeout: 10_000,
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
      // Fixed dist dir: Next dev appends `<distDir>/types/**/*.ts` to
      // tsconfig.json's include with an EXACT-string check, so per-process
      // names polluted tsconfig with one entry per run. A prior Playwright
      // process tearing down late can, rarely, delete files of the next run's
      // server — if a boot flakes, rerun (dev-only trade-off).
      NEXT_DIST_DIR: '.next/e2e',
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? 'test-only-secret-not-used-in-production',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? baseURL,
    },
  },
})
