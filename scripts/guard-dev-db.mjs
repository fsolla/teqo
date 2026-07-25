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

import { assertLocalDatabase } from './assert-local-database.mjs'
import { diagnoseDatabaseTarget, warnOnSharedDataVolumes } from './db-doctor.mjs'

// Mirror Next.js precedence (.env.local wins over .env) WITHOUT overriding a
// DATABASE_URL that is already set in the real environment (e.g. injected by
// Playwright's webServer). dotenv's default `override: false` guarantees this.
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

assertLocalDatabase(
  'guard-dev-db',
  'This is almost certainly the production or a shared database.\n\n' +
    'Local development should use the local Postgres from docker-compose:\n' +
    '  1. pnpm db:start\n' +
    '  2. set DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo in .env.local',
)

// Connectivity preflight: fail here with a named remedy (which container to
// start, who is holding the port) instead of letting Next/Payload throw a
// bare ECONNREFUSED minutes into the dev session. Skipped under the same
// escape hatch as the locality guard — remote databases are on their own.
if (process.env.ALLOW_REMOTE_DB !== 'true' && process.env.ALLOW_REMOTE_DB !== '1') {
  const volumesClean = warnOnSharedDataVolumes()
  const healthy = await diagnoseDatabaseTarget({
    label: 'guard-dev-db',
    databaseUrl: process.env.DATABASE_URL,
  })
  if (!healthy || !volumesClean) process.exit(1)
}
