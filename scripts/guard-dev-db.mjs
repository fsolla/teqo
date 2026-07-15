/**
 * Refuses to start the local dev server against a non-local database.
 *
 * Local development must use the Postgres from docker-compose. Pointing dev at
 * the production Neon database (as .env / .env.local currently do) risks editing
 * or deleting real data through the admin panel. This guard fails closed.
 *
 * Escape hatch (use with care): ALLOW_REMOTE_DB=true pnpm dev
 */
import { config as loadEnv } from 'dotenv'

const OVERRIDE_FLAG = 'ALLOW_REMOTE_DB'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'postgres'])

// Mirror Next.js precedence (.env.local wins over .env) WITHOUT overriding a
// DATABASE_URL that is already set in the real environment (e.g. injected by
// Playwright's webServer). dotenv's default `override: false` guarantees this.
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const fail = (message) => {
  console.error(`\n[guard-dev-db] ${message}\n`)
  process.exit(1)
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  fail('DATABASE_URL is not set. Refusing to start the dev server.')
}

if (process.env[OVERRIDE_FLAG] === 'true' || process.env[OVERRIDE_FLAG] === '1') {
  console.warn(
    `\n[guard-dev-db] ${OVERRIDE_FLAG} is set — connecting to a remote database on purpose. Be careful.\n`,
  )
  process.exit(0)
}

let host
try {
  host = new URL(databaseUrl).hostname
} catch {
  fail('DATABASE_URL is not a valid connection string.')
}

if (!LOCAL_HOSTS.has(host)) {
  fail(
    `DATABASE_URL points at a non-local host ("${host}").\n` +
      'This is almost certainly the production or a shared database.\n\n' +
      'Local development should use the local Postgres from docker-compose:\n' +
      '  1. pnpm db:start\n' +
      '  2. set DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo in .env.local\n\n' +
      `If you REALLY mean to connect to a remote database, re-run with:\n  ${OVERRIDE_FLAG}=true pnpm dev`,
  )
}

console.log(`[guard-dev-db] OK — using local database host "${host}".`)
