/**
 * D6 — read-only diagnostic of the /campanha push delivery chain, closing one
 * verdict per link: VAPID envs → published consent → per-device subscriptions →
 * event log → SW served (build id per deploy).
 *
 * Safety model:
 *   - PROD_DATABASE_URL is only READ: every connection runs with
 *     `default_transaction_read_only = on` and a statement timeout. No writes
 *     are possible from this script.
 *   - The site URL is only fetched with GET.
 *
 * Usage:
 *   PROD_DATABASE_URL=postgres://... pnpm db:check:push-chain [--site https://jorgesolla1313.com.br]
 *
 * PROD_DATABASE_URL should be the connection string from the homeserver stack
 * (`~/stack/teqo-1313.env`). The VAPID env check reads process.env — source
 * them the same way, or run the check inside an environment that already has
 * them.
 */
import { Client } from 'pg'

import { dieWithLabel, loadCliEnv, LOCAL_HOSTS } from './lib/cli.mjs'

const die = dieWithLabel('check:push-chain')

loadCliEnv()

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL
if (!PROD_DATABASE_URL) {
  die(
    'PROD_DATABASE_URL is not set.\n' +
      'Run it with the production connection string (today: homeserver `teqo_1313`, the\n' +
      '  `DATABASE_URL` of `~/stack/teqo-1313.env` on the homeserver):\n' +
      '  PROD_DATABASE_URL="postgresql://teqo_1313:...@postgres:5432/teqo_1313" pnpm db:check:push-chain',
  )
}

// Foot-gun guard: this script reports PRODUCTION facts; a local URL would
// produce verdicts about the wrong data that look like prod.
if (LOCAL_HOSTS.has(new URL(PROD_DATABASE_URL).hostname)) {
  die(`PROD_DATABASE_URL points at a local host ("${new URL(PROD_DATABASE_URL).hostname}").`)
}

let site
try {
  const siteArg = process.argv.find((arg) => arg.startsWith('--site='))
  site = new URL(siteArg?.slice('--site='.length) || 'https://jorgesolla1313.com.br').origin
} catch {
  die('--site=<url> deve ser uma URL válida (ex.: https://jorgesolla1313.com.br).')
}

const results = []
const report = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}: ${detail}`)
}

const fetchWithTimeout = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'follow' })
  return { response, body: await response.text() }
}

console.log(`[check:push-chain] Site: ${site}`)

// --- Elo 1: service worker served with a deploy-scoped build id ---------------
// `campanha-dev` = CAMPAIGN_CACHE_PREFIX ('campanha-') + fallback 'dev' of
// resolveCampaignPwaBuildId frozen at build time (the D6 defect).
try {
  const { response, body } = await fetchWithTimeout(`${site}/campanha/sw.js`)
  const cacheName = body.match(/CACHE_NAME\s*=\s*"([^"]+)"/)?.[1] ?? null
  const frozenBuild = cacheName === 'campanha-dev'
  report(
    'SW servido',
    response.ok && cacheName !== null && !frozenBuild,
    response.ok
      ? `HTTP ${response.status}, cache name "${cacheName}" (${frozenBuild ? 'build id congelado no build — defeito D6' : 'versionado por deploy'})`
      : `HTTP ${response.status}`,
  )
} catch (error) {
  report('SW servido', false, `falha ao buscar ${site}/campanha/sw.js: ${error.message}`)
}

// --- Elo 2: VAPID envs (server + public) --------------------------------------
// Proves the DIAGNOSTIC environment, not the deployment — source them from
// `~/stack/teqo-1313.env` on the homeserver to mirror the deployed server.
const vapidServer = process.env.VAPID_PUBLIC_KEY?.trim()
const vapidPrivate = process.env.VAPID_PRIVATE_KEY?.trim()
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
const missingEnvs = [
  !vapidServer && 'VAPID_PUBLIC_KEY',
  !vapidPrivate && 'VAPID_PRIVATE_KEY',
  !vapidPublic && 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
].filter(Boolean)
report(
  'Envs VAPID (ambiente de diagnóstico)',
  missingEnvs.length === 0,
  missingEnvs.length === 0
    ? 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY presentes'
    : `ausentes no process.env: ${missingEnvs.join(', ')} (fonte: vercel env pull)`,
)

// --- Elos 3–5: DB (read-only) -------------------------------------------------
// Neon URLs carry `sslmode=require`; upgrade it to verify-full so pg keeps
// certificate verification without its v8 warning for `require` aliases.
const connectionString = PROD_DATABASE_URL.replace('sslmode=require', 'sslmode=verify-full')
const client = new Client({ connectionString })

try {
  await client.connect()
  await client.query('SET default_transaction_read_only = on')
  await client.query('SET statement_timeout = 15000')

  // Elo 3: consent published — stable key lives in src/lib/campaignConsentKeys.ts
  const consent = await client.query(
    `SELECT key, updated_at FROM consent WHERE key = 'campanha-notificacoes-push' LIMIT 1`,
  )
  report(
    'Consentimento',
    consent.rowCount === 1,
    consent.rowCount === 1
      ? `campanha-notificacoes-push publicado (atualizado ${consent.rows[0].updated_at})`
      : 'chave campanha-notificacoes-push ausente na collection consent',
  )

  // Elo 4: per-device subscriptions
  const subscriptionCount = await client.query('SELECT count(*)::int AS n FROM push_subscription')
  const subscriptionsByUser = await client.query(
    `SELECT COALESCE(cu.name, '<campaign_user excluído>') AS user_name, count(ps.id)::int AS n
       FROM push_subscription ps
       LEFT JOIN campaign_user cu ON cu.id = ps.user_id
      GROUP BY user_name
      ORDER BY n DESC`,
  )
  const userBreakdown =
    subscriptionsByUser.rows.length === 0
      ? 'nenhuma'
      : subscriptionsByUser.rows.map((row) => `${row.user_name} (${row.n})`).join(', ')
  report(
    'Inscrições push',
    subscriptionCount.rows[0].n > 0,
    `${subscriptionCount.rows[0].n} inscrição(ões) — ${userBreakdown}`,
  )

  // Elo 5: event log feeding the chain
  const events = await client.query(
    `SELECT count(*)::int AS n, max(created_at) AS last FROM notification`,
  )
  const eventsByType = await client.query(
    `SELECT type, count(*)::int AS n FROM notification GROUP BY type ORDER BY n DESC`,
  )
  report(
    'Eventos (log Notification)',
    events.rows[0].n > 0,
    events.rows[0].n > 0
      ? `${events.rows[0].n} evento(s), último ${events.rows[0].last} — ${eventsByType.rows
          .map((row) => `${row.type} (${row.n})`)
          .join(', ')}`
      : 'nenhum evento registrado ainda',
  )
} catch (error) {
  report('DB (leituras)', false, `falha ao consultar: ${error.message}`)
} finally {
  await client.end().catch(() => {})
}

// --- Verdict ------------------------------------------------------------------
console.log('')
const failed = results.filter((result) => !result.ok)
if (failed.length === 0) {
  console.log(`[check:push-chain] OK — ${results.length}/${results.length} elos fechados.`)
} else {
  console.log(`[check:push-chain] ${failed.length} elo(s) quebrado(s):`)
  for (const result of failed) console.log(`  - ${result.name}`)
  process.exit(1)
}
