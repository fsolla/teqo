#!/usr/bin/env node
/**
 * Deterministic test-database reset (OPS88) — one Postgres per run, a clean
 * baseline between phases.
 *
 * `DROP SCHEMA public CASCADE` + `CREATE SCHEMA public`, then `pnpm migrate`
 * and `pnpm db:seed:minimal` rebuild the exact baseline a fresh service would
 * have (migrations re-seed the 435-municipality catalog; the minimal seed is
 * idempotent). CI runs it between the integration phase and the build/e2e
 * phase — this replaces the former second Postgres container whose only job
 * was hiding int fixture residue from the e2e.
 *
 * Safety: drops data BY DESIGN, so it is stricter than the other db scripts —
 * there is NO ALLOW_REMOTE_DB escape here. It refuses everything but a LOCAL
 * database whose name matches TEST_DATABASE_NAME_RE (`teqo_test` or
 * `teqo_<worktree>_test`). The dev database `teqo` and anything remote fail
 * closed. (assertLocalDatabase is not used on purpose: its remote override
 * must never arm a DROP SCHEMA.)
 *
 * Usage:
 *   DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test pnpm db:reset
 * (In CI the step env carries DATABASE_URL from the earlier prep step.)
 */
import { execFileSync } from 'node:child_process'

import pg from 'pg'

import { dieWithLabel, loadCliEnv, LOCAL_HOSTS, TEST_DATABASE_NAME_RE } from './lib/cli.mjs'

loadCliEnv()

const die = dieWithLabel('db:reset')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) die('DATABASE_URL is not set. Refusing to continue.')

let parsedUrl
try {
  parsedUrl = new URL(databaseUrl)
} catch {
  die('DATABASE_URL is not a valid PostgreSQL connection string.')
}

if (parsedUrl.protocol !== 'postgresql:') {
  die(`Refusing to reset over protocol "${parsedUrl.protocol || '(unknown)'}".`)
}

if (!LOCAL_HOSTS.has(parsedUrl.hostname)) {
  die(
    `Refusing to reset on a non-local host ("${parsedUrl.hostname}"). ` +
      'This script drops the schema — there is no remote override by design.',
  )
}

const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''))
if (!TEST_DATABASE_NAME_RE.test(databaseName)) {
  die(
    `Refusing to reset database "${databaseName}" — the name must match ` +
      '`teqo_test` or `teqo_<worktree>_test` (TEST_DATABASE_NAME_RE). The dev database is never reset.',
  )
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })
try {
  console.log(`[db:reset] Dropping schema public on "${databaseName}"…`)
  await pool.query('DROP SCHEMA public CASCADE')
  await pool.query('CREATE SCHEMA public')
  console.log('[db:reset] Schema rebuilt — running migrate…')
} finally {
  await pool.end()
}

execFileSync('pnpm', ['migrate'], { stdio: 'inherit' })
console.log('[db:reset] Migrations applied — seeding minimal baseline…')
execFileSync('pnpm', ['db:seed:minimal'], { stdio: 'inherit' })

console.log('[db:reset] ✓ deterministic baseline ready (migrate + db:seed:minimal).')
