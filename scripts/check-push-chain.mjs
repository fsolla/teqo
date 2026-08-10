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
 *   PROD_DATABASE_URL=postgres://... pnpm db:check:push-chain [--site https://pt.jorgesolla.com.br]
 *
 * PROD_DATABASE_URL should be the UNPOOLED Neon connection string (the
 * DATABASE_URL_UNPOOLED value from `vercel env pull --environment=production`).
 * The VAPID env check reads process.env — source them the same way, or run the
 * check inside an environment that already has them.
 */
import { Client } from 'pg'

import { dieWithLabel, loadCliEnv } from './lib/cli.mjs'

const die = dieWithLabel('check:push-chain')

loadCliEnv()

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL
if (!PROD_DATABASE_URL) {
  die(
    'PROD_DATABASE_URL is not set.\n' +
      'Run it with your UNPOOLED Neon URL (DATABASE_URL_UNPOOLED from `vercel env pull`):\n' +
      '  PROD_DATABASE_URL="postgres://...neon.tech/neondb?sslmode=require" pnpm db:check:push-chain',
  )
}

const siteArg = process.argv.find((arg) => arg.startsWith('--site='))
const site = siteArg?.slice('--site='.length) || 'https://pt.jorgesolla.com.br'
const siteOrigin = new URL(site).origin

const results = []
const report = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}: ${detail}`)
}

const fetchWithTimeout = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'follow' })
  return { response, body: await response.text() }
}

console.log(`[check:push-chain] Site: ${siteOrigin}`)

// --- Elo 1: service worker served with a deploy-scoped build id ---------------
try {
  const { response, body } = await fetchWithTimeout(`${siteOrigin}/campanha/sw.js`)
  const cacheName = body.match(/CACHE_NAME\s*=\s*"([^"]+)"/)?.[1] ?? null
  const frozenBuild = cacheName === 'campanha-dev' || cacheName === 'campanha-dev"'
  report(
    'SW servido',
    response.ok && cacheName !== null && !frozenBuild,
    response.ok
      ? `HTTP ${response.status}, cache name "${cacheName}" (${frozenBuild ? 'build id congelado no build — defeito D6' : 'versionado por deploy'})`
      : `HTTP ${response.status}`,
  )
} catch (error) {
  report('SW servido', false, `falha ao buscar ${siteOrigin}/campanha/sw.js: ${error.message}`)
}

// --- Elo 2: VAPID envs (server + public) --------------------------------------
const vapidServer = process.env.VAPID_PUBLIC_KEY?.trim()
const vapidPrivate = process.env.VAPID_PRIVATE_KEY?.trim()
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
const missingEnvs = [
  !vapidServer && 'VAPID_PUBLIC_KEY',
  !vapidPrivate && 'VAPID_PRIVATE_KEY',
  !vapidPublic && 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
].filter(Boolean)
report(
  'Envs VAPID',
  missingEnvs.length === 0,
  missingEnvs.length === 0
    ? 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY presentes'
    : `ausentes no process.env: ${missingEnvs.join(', ')} (fonte: vercel env pull)`,
)

// --- Elos 3–5: DB (read-only) -------------------------------------------------
// Neon URLs carry `sslmode=require`; hand TLS explicitly so pg-connection-string
// does not emit its v8 deprecation warning for that mode.
const hadSslMode = /sslmode=require/.test(PROD_DATABASE_URL)
const connectionString = hadSslMode
  ? PROD_DATABASE_URL.replace(/sslmode=require/, '').replace(/[?&]$/, '')
  : PROD_DATABASE_URL
const client = new Client({
  connectionString,
  ...(hadSslMode ? { ssl: { rejectUnauthorized: false } } : {}),
})

try {
  await client.connect()
  await client.query('SET default_transaction_read_only = on')
  await client.query('SET statement_timeout = 15000')

  // Elo 3: consent published
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
