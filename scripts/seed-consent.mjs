/**
 * Re-applies Onda 0 provisional Consent keys and privacy-policy global.
 * Idempotent upsert — same logic as migration 20260719_054707_seed_onda0_consent_and_privacy.
 *
 * Safety: refuses non-local DATABASE_URL unless ALLOW_REMOTE_DB=true.
 *
 * Usage:
 *   pnpm db:seed:consent
 *   ALLOW_REMOTE_DB=true pnpm db:seed:consent
 */

import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

import { assertLocalDatabase } from './assert-local-database.mjs'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

assertLocalDatabase(
  'seed:consent',
  'This script upserts provisional Consent/privacy texts. Use migrations for prod deploy.',
)

const config = (await import('../src/payload.config.ts')).default
const { provisionOnda0ConsentAndPrivacy } = await import('../src/utilities/onda0Provision.ts')

const payload = await getPayload({ config })

try {
  await provisionOnda0ConsentAndPrivacy(payload)
  console.log('[seed:consent] OK — provisional Consent keys and privacy-policy global updated.')
  console.log(
    '[seed:consent] Bust deployed /privacidade cache (CLI cannot revalidate the server runtime):',
  )
  console.log(
    '  curl -X POST "$NEXT_PUBLIC_SITE_URL/api/revalidate?tag=global_privacy-policy" \\\n' +
      '    -H "x-revalidate-secret: $REVALIDATE_SECRET"',
  )
} catch (error) {
  console.error(`\n[seed:consent] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}

process.exit(0)
