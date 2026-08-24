import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

import { assertTestDatabase } from './tests/helpers/assertTestDatabase'

/*
 * OPS46 — a bare `playwright test` (VS Code extension, `pnpm exec playwright
 * test --list`, ad-hoc runs) must collect like `pnpm test:e2e` does. That
 * script carries the needed flags in NODE_OPTIONS (`--conditions=react-server
 * --import=tsx/esm`); this block re-applies the same behavior whenever that
 * PAIR is not complete (a lone `--conditions=react-server` from build/migrate
 * still leaves `next/cache` unresolvable):
 *  - register() installs the resolution hook (tests/helpers/e2eEsmResolve.mjs)
 *    in THIS process — test collection happens here after config load, which
 *    is why a bare `--list` needs it in-process;
 *  - the NODE_OPTIONS mutation hands the same hook to the worker processes
 *    Playwright spawns for actual runs (they inherit the env at spawn).
 * When the scripted pair is already present nothing changes.
 */
const scriptedNodeOptions =
  process.env.NODE_OPTIONS?.includes('--conditions=react-server') &&
  process.env.NODE_OPTIONS?.includes('--import=tsx/esm')
if (!scriptedNodeOptions) {
  register(new URL('./tests/helpers/e2eEsmResolve.mjs', import.meta.url))
  const loaderEntry = fileURLToPath(new URL('./tests/helpers/e2eEsmLoader.mjs', import.meta.url))
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--import=${loaderEntry}`]
    .filter(Boolean)
    .join(' ')
}

import {
  GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV_NAME,
  GOOGLE_CALENDAR_TEST_KEY,
} from './tests/helpers/googleCalendarTestKey'
import { instagramStubUrlFor, youtubeStubUrlFor } from './tests/helpers/socialStub'

/**
 * e2e tests boot a real dev server that seeds/deletes records, so they must run
 * against the isolated test database — never .env / .env.local (production).
 * `override: true` guarantees the test DB wins over anything in the shell.
 */
loadEnv({ path: '.env.test', override: true })
// Per-worktree isolation: `.env.test.local` (gitignored, written by
// `pnpm worktree next`) wins over the committed `.env.test` when present.
loadEnv({ path: '.env.test.local', override: true })

// Optional local override when the default Docker port is occupied (e.g. mapped
// to 5433) — same escape hatch vitest.setup.ts documents.
if (process.env.TEQO_TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEQO_TEST_DATABASE_URL
}

assertTestDatabase(process.env.DATABASE_URL)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const webServerPort = new URL(baseURL).port || (baseURL.startsWith('https:') ? '443' : '80')
/*
 * Ports of the social-feed stubs the content board fetches in e2e (S2
 * YouTube, S3 Instagram). dev ports live in 3100..4099 (worktree slots,
 * capped at 999), so +1000 (YouTube) and +2000 (Instagram) never collide
 * with another worktree's dev server nor with each other; CI stays on 4000
 * and 5000. The derivation lives once in `tests/helpers/socialStub.ts` (the
 * spec uses it to flip the stub states).
 */
const youtubeStubUrl = youtubeStubUrlFor(baseURL)
const youtubeStubPort = new URL(youtubeStubUrl).port
const instagramStubUrl = instagramStubUrlFor(baseURL)
const instagramStubPort = new URL(instagramStubUrl).port
/*
 * Canonical HTTPS origin the e2e prod build inlines as NEXT_PUBLIC_SITE_URL
 * (OPS83 Decision B): `requireProductionDNSOrigin` demands an HTTPS public DNS
 * name, so the agenda feed dialog can generate a link under the production
 * build. `.test` is a reserved TLD (RFC 6761) — never resolves, exists only so
 * the feed link passes the guard; the specs fetch the feed via `campaign.baseURL
 * + path`, never this origin.
 */
const CANONICAL_E2E_ORIGIN = 'https://feed.e2e.teqo.test'

const workersOverride = process.env.PLAYWRIGHT_WORKERS
const workers = workersOverride === undefined ? 2 : Number(workersOverride)
if (!Number.isInteger(workers) || workers < 2) {
  throw new Error('PLAYWRIGHT_WORKERS must be an integer of at least 2.')
}
/*
 * Prod mode (CI or E2E_PROD=1) serves the PRODUCTION build, where no dev-mode
 * compile exists. The `setup` project (route prewarm) and the project chain
 * (setup → campaign → frontend → admin) exist to stabilize dev-mode cold
 * compiles; against a production build they are pure cost — measured 2026-08-10
 * (OPS34): the 25 prewarm requests plus the 4-test frontend/admin tail behind
 * the ~30-file campaign family. Prod mode therefore drops the setup project and
 * the dependencies so all families run in parallel; CI runs the suite in one
 * process with `PLAYWRIGHT_WORKERS` (ci.yml / ci-pr.yml, OPS62 X1). Dev mode
 * is unchanged.
 * Note the chain is an ordering guarantee for dev cold compiles, not a data
 * dependency: specs are self-contained in both modes (fixtures + advisory
 * locks), so dropping it in prod cannot reorder shared fixtures.
 */
const isProdMode = Boolean(process.env.CI) || process.env.E2E_PROD === '1'

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
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'html',
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
  /*
   * CLI filtering in dev mode (S6-FOLLOWUP, 2026-08-18): positional test paths
   * ARE parsed and matched per file, but the project dependency chain below
   * (setup -> campaign -> frontend -> admin, dev mode only) makes the runner
   * drag ALL files of every dependency project into a selected run
   * (buildProjectsClosure) — filtering to one frontend spec runs the whole
   * campaign family. Prod mode (CI / E2E_PROD=1) has no dependencies, so the
   * filter works as-is (the CI selected job relies on this). Local recipes:
   *   pnpm test:e2e --no-deps -- tests/e2e/campaignHomeActions.e2e.spec.ts
   *   pnpm test:e2e --no-deps --project=campaign
   * -g/--grep and --list DO work (title/file filters); pair them with
   * --no-deps/--project for deterministic runs. `pnpm test:e2e:affected`
   * generates the --no-deps form automatically.
   */
  projects: [
    /*
     * `setup` prewarms shared Next route bundles against the dev server's cold
     * compile cache. In prod mode there is no compile to prewarm and the whole
     * chain is pure cost (see `isProdMode` above), so the setup project only
     * exists in dev; an unmatched spec file is simply not collected.
     */
    ...(isProdMode
      ? []
      : [
          {
            name: 'setup',
            testMatch: /setup\.e2e\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], channel: 'chromium' },
          },
        ]),
    {
      name: 'campaign',
      testMatch: /campaign.*\.e2e\.spec\.ts/,
      dependencies: isProdMode ? [] : ['setup'],
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
    {
      name: 'frontend',
      testMatch: /frontend\.e2e\.spec\.ts/,
      dependencies: isProdMode ? [] : ['campaign'],
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
    {
      name: 'admin',
      testMatch: /admin\.e2e\.spec\.ts/,
      // Serialize behind `frontend` in BOTH modes: admin's Instagram sync
      // panel and the frontend IG feed specs share the instagram stub and the
      // `social-feed-settings` global (single server process). Drop the
      // dependency in prod and the two projects run concurrently, letting a
      // frontend IG test flip the stub/global while admin:134 seeds and syncs
      // (OPS83 run #16: hard-failed all 3 retries on the shared stub state).
      dependencies: ['frontend'],
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: [
    {
      /*
       * CI and E2E_PROD=1 serve the PRODUCTION build (`pnpm start` after a
       * `pnpm build` step in the e2e job): dev-mode cold webpack compiles per
       * route plus dev-server memory restarts made the full suite blow the 30-min
       * job timeout on CI (measured 2026-07-30). The municipalities-list React
       * #130 was fixed by sharing one Drawer across the mobile cards
       * (CampaignListSheetProvider, 2026-07-30). Locally `pnpm dev` stays the
       * default: no build wait and hot reload while writing specs.
       */
      command: isProdMode ? 'pnpm start' : 'pnpm dev',
      /*
       * Never reuse a dev server a developer may already have running against the
       * production database — always start a fresh one bound to the test DB.
       */
      reuseExistingServer: false,
      url: baseURL,
      // Local-only tolerance for parallel-worktree load (machine load ~60); CI
      // boots the production build and keeps the usual 60s budget. Keyed on CI
      // alone (not `isProdMode`) on purpose: a local `E2E_PROD=1` run keeps the
      // 240s budget — prod-mode here is a local mirror, not a real CI runner.
      timeout: process.env.CI ? undefined : 240_000,
      /* Force the isolated test database into the server process. */
      env: {
        DATABASE_URL: process.env.DATABASE_URL as string,
        PORT: webServerPort,
        /*
         * C122 — the fake service-account key lets the agenda Google mirror
         * derive real states (synced/disabled/paused) in the server process.
         * It parses as a credential but fails locally at JWT signing, so any
         * sync pass the hooks/auto-retry run fails fast WITHOUT network — the
         * e2e states stay deterministic (see `googleCalendarTestKey.ts`).
         */
        [GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV_NAME]: GOOGLE_CALENDAR_TEST_KEY,
        // Keep e2e artifacts outside `.next`: a concurrent development server
        // owns that entire directory and may clear nested production bundles.
        NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? '.next-e2e',
        PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? 'test-only-secret-not-used-in-production',
        // Prod mode serves a production build where `getCampaignInviteBaseURL`
        // fails closed unless NEXT_PUBLIC_SITE_URL is an HTTPS public DNS name
        // (C98). The e2e build inlines this same value (see the "Build for e2e"
        // steps in deploy.yml/ci-pr.yml), so the dialog-generated feed link is
        // canonical — and the spec fetches it back via `campaign.baseURL`, never
        // the absolute origin (OPS83 Decision B).
        NEXT_PUBLIC_SITE_URL:
          process.env.NEXT_PUBLIC_SITE_URL ?? (isProdMode ? CANONICAL_E2E_ORIGIN : baseURL),
        // Lets e2e specs bust the `posts` tag after direct REST deletes (cleanup),
        // mirroring the documented post-seed runbook against the deployed site.
        REVALIDATE_SECRET: process.env.REVALIDATE_SECRET ?? 'e2e-revalidate-secret',
        // The content board (S2/S3) fetches the YouTube Data API and the
        // Instagram Graph API through the local stubs below instead of the
        // real network (deterministic fixtures).
        YOUTUBE_API_BASE_URL: youtubeStubUrl,
        INSTAGRAM_API_BASE_URL: instagramStubUrl,
      },
    },
    {
      /* Deterministic YouTube Data API v3 responses for the content board. */
      command: `node tests/e2e/youtube-stub.mjs`,
      reuseExistingServer: false,
      url: `${youtubeStubUrl}/__stub/health`,
      timeout: 30_000,
      env: {
        YOUTUBE_STUB_PORT: String(youtubeStubPort),
      },
    },
    {
      /* Deterministic Instagram Graph API responses for the content board. */
      command: `node tests/e2e/instagram-stub.mjs`,
      reuseExistingServer: false,
      url: `${instagramStubUrl}/__stub/health`,
      timeout: 30_000,
      env: {
        INSTAGRAM_STUB_PORT: String(instagramStubPort),
      },
    },
  ],
})
