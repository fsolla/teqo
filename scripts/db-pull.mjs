/**
 * Pulls a CONTENT-ONLY copy of the production database into the local Postgres.
 *
 * Safety model:
 *   - Source (production) is only ever READ, via `pg_dump`. This script issues
 *     no writes against production and cannot: it never even opens a writable
 *     connection to the source.
 *   - Target must be a LOCAL host (same guard as the dev server). The script
 *     refuses to restore into anything that isn't localhost.
 *   - PII is excluded: the data of the `contact`, `signature` and `subscription`
 *     tables (real supporters' names, e-mails, phones, CEP) is NOT copied. Their
 *     table structure is kept so the app still works; only the rows are omitted.
 *
 * Usage:
 *   PROD_DATABASE_URL=postgres://... pnpm db:pull
 *
 * PROD_DATABASE_URL should be the UNPOOLED Neon connection string (the
 * DATABASE_URL_UNPOOLED value in .env.local).
 */
import { execFileSync } from 'node:child_process'
import { dieWithLabel, LOCAL_HOSTS } from './lib/cli.mjs'

const PG_IMAGE = 'postgres:17-alpine' // must match the prod major version
const PII_TABLE_REGEX = '^(contact|signature|subscription)(_|$)'

const prodUrl = process.env.PROD_DATABASE_URL
const localUrl = process.env.LOCAL_DATABASE_URL ?? 'postgresql://teqo:teqo@localhost:5432/teqo'

const die = dieWithLabel('db:pull')

if (!prodUrl) {
  die(
    'PROD_DATABASE_URL is not set.\n' +
      'Run it with your UNPOOLED Neon URL (DATABASE_URL_UNPOOLED in .env.local):\n' +
      '  PROD_DATABASE_URL="postgres://...neon.tech/neondb?sslmode=require" pnpm db:pull',
  )
}

let targetHost
try {
  targetHost = new URL(localUrl).hostname
} catch {
  die('LOCAL_DATABASE_URL is not a valid connection string.')
}
if (!LOCAL_HOSTS.has(targetHost)) {
  die(`Refusing to restore into non-local host "${targetHost}". This script only writes to local.`)
}

// The local Postgres runs as the docker-compose "postgres" service. We run all
// restore commands inside that container so we don't depend on a local psql.
const containerId = execFileSync('docker', ['compose', 'ps', '-q', 'postgres'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')[0]

if (!containerId) {
  die('Local Postgres container is not running. Start it with `pnpm db:start` first.')
}

const targetUrl = new URL(localUrl)
const targetDb = targetUrl.pathname.replace(/^\//, '')

const runInPgImage = (shellCommand) =>
  execFileSync(
    'docker',
    ['run', '--rm', '-e', `PGURL=${prodUrl}`, PG_IMAGE, 'sh', '-c', shellCommand],
    {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 512,
    },
  )

console.log(`[db:pull] Source (read-only): ${new URL(prodUrl).hostname}`)
console.log(`[db:pull] Target (local):     ${targetHost}/${targetDb}`)

// 1. Discover PII tables to exclude (contact/signature/subscription and their
//    relationship/locale tables), directly from the production catalog.
console.log('[db:pull] Discovering PII tables to exclude...')
const piiTables = runInPgImage(
  `psql "$PGURL" -tAc "SELECT table_name FROM information_schema.tables ` +
    `WHERE table_schema='public' AND table_name ~ '${PII_TABLE_REGEX}' ORDER BY table_name;"`,
)
  .trim()
  .split('\n')
  .filter(Boolean)

console.log(`[db:pull] Excluding data from: ${piiTables.join(', ') || '(none found)'}`)

const excludeArgs = [
  ...piiTables.map((t) => `--exclude-table-data='public.${t}'`),
  // Never carry prod's migration tracking into local.
  `--exclude-table='public.payload_migrations'`,
  `--exclude-table='public.payload_migrations_id_seq'`,
].join(' ')

// 2. Dump prod (schema for everything + data for non-PII tables), plain SQL.
console.log('[db:pull] Dumping production (this reads prod, never writes)...')
const dumpSql = runInPgImage(`pg_dump "$PGURL" --no-owner --no-privileges ${excludeArgs}`)

// 3. Reset the local schema and restore into it.
console.log('[db:pull] Resetting local schema...')
execFileSync(
  'docker',
  [
    'exec',
    '-i',
    containerId,
    'psql',
    '-U',
    'teqo',
    '-d',
    targetDb,
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
  ],
  { stdio: ['ignore', 'inherit', 'inherit'] },
)

console.log('[db:pull] Restoring into local...')
execFileSync(
  'docker',
  [
    'exec',
    '-i',
    containerId,
    'psql',
    '-U',
    'teqo',
    '-d',
    targetDb,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    '-',
  ],
  { input: dumpSql, stdio: ['pipe', 'inherit', 'inherit'], maxBuffer: 1024 * 1024 * 512 },
)

console.log('\n[db:pull] Done. Local now mirrors production content (without supporter PII).')
