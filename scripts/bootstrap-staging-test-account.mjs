/**
 * OPS125 — bootstrap the synthetic staging test account.
 *
 * Creates/updates the `campaignUser` the `work-issue` post-deploy verification
 * (OPS121) logs in with at `https://staging.jorgesolla1313.com.br`. Runs ONLY
 * against the `teqo_staging` database on the homeserver, guarded by
 * `assertStagingTestAccountTarget` (see `scripts/lib/staging-test-account.mjs`).
 *
 * The password comes from `STAGING_TEST_ACCOUNT_PASSWORD` (never in code, never
 * committed) — read from `~/stack/teqo-staging.env` on the homeserver:
 *
 *   ssh homeserver
 *   cd ~/teqo-deploy && pnpm install
 *   set -a; source ~/stack/teqo-staging.env; set +a
 *   export DATABASE_URL="${DATABASE_URL/@postgres:5432/@127.0.0.1:5434}"
 *   STAGING_TEST_ACCOUNT_CONFIRM=1 pnpm campaign:staging:test-account
 *
 * Re-run after recreating the staging DB (e.g. a fresh copy of production).
 * Runbook: docs/ops/teqo-1313-deploy.md §Staging.
 *
 * The agent that consumes the credential NEVER runs this script and never
 * receives `DATABASE_URL` — it only logs into the application.
 */

import { getPayload } from 'payload'

import { dieWithLabel, loadCliEnv } from './lib/cli.mjs'
import {
  assertStagingTestAccountPassword,
  assertStagingTestAccountTarget,
  STAGING_DATABASE_NAME,
  STAGING_TEST_ACCOUNT,
  STAGING_TEST_ACCOUNT_PASSWORD_ENV,
  upsertStagingTestAccount,
} from './lib/staging-test-account.mjs'

loadCliEnv()

const die = dieWithLabel('staging:test-account')

const run = async () => {
  const password = process.env[STAGING_TEST_ACCOUNT_PASSWORD_ENV]
  try {
    assertStagingTestAccountPassword(password)
    assertStagingTestAccountTarget()
  } catch (error) {
    die(error instanceof Error ? error.message : String(error))
  }

  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })
  const result = await upsertStagingTestAccount(payload, { password })

  // Never log the password — only the identity and the target.
  console.log(
    `[staging:test-account] ${result.operation} ${STAGING_TEST_ACCOUNT.email} ` +
      `(role ${STAGING_TEST_ACCOUNT.role}, id ${result.id}) on ${STAGING_DATABASE_NAME}`,
  )
  process.exit(0)
}

run().catch((error) => die(error?.message || String(error)))
