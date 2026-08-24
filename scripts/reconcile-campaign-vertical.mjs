/**
 * OPS79 — read-only reconciliation of the campaign vertical between the old
 * platform (Neon, frozen by OPS80) and the new platform (`teqo_1313`).
 *
 * Purpose: prove "nada órfão, nada duplicado" for the campaign vertical after
 * the OPS51 dump/restore. Compares counts AND id-sets of the 13 campaign
 * collections, plus the semantic content of the relationship join tables
 * (municipality_rels / leadership_rels / activity_rels / organization_rels /
 * state_deputy_rels / campaign_demand_rels) by (parent, path, child).
 *
 * Safety model:
 *   - READ-ONLY: every connection runs `default_transaction_read_only = on`
 *     and a statement timeout. No writes are possible from this script.
 *   - NEVER prints PII: only ids, counts and relation keys are reported.
 *   - Both URLs come from env; the operator supplies them on the homeserver
 *     (NEON_DATABASE_URL from ~/stack/.env; DATABASE_URL from
 *     ~/stack/teqo-1313.env, rewritten to the socat proxy 127.0.0.1:5433 —
 *     see the OPS79 runbook in docs/ops/teqo-1313-deploy.md).
 *
 * Usage:
 *   NEON_DATABASE_URL=postgres://... DATABASE_URL=postgres://... \
 *     pnpm ops79:reconcile
 */
import { Client } from 'pg'

import { dieWithLabel, loadCliEnv } from './lib/cli.mjs'

const die = dieWithLabel('ops79:reconcile')

loadCliEnv()

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL
const TARGET_DATABASE_URL = process.env.DATABASE_URL

if (!NEON_DATABASE_URL) die('NEON_DATABASE_URL is not set (fonte: ~/stack/.env no homeserver).')
if (!TARGET_DATABASE_URL) die('DATABASE_URL is not set (target teqo_1313).')

// Campaign vertical collections (id-bearing, content tables).
const CORE_TABLES = [
  'campaign_user',
  'leadership',
  'vote_pledge',
  'activity',
  'municipality',
  'organization',
  'allocation_decision',
  'municipality_update',
  'state_deputy',
  'election_tally',
  'campaign_web_authn_credential',
  'supporter',
  'campaign_demand',
]

// Relationship join tables compared semantically (parent, path, child).
const REL_TABLES = [
  'municipality_rels',
  'leadership_rels',
  'activity_rels',
  'organization_rels',
  'state_deputy_rels',
  'campaign_demand_rels',
]

// Known non-data divergences absorbed by OPS79 (verified read-only on
// 2026-08-23). They reflect PORTFOLIO EDITS made on the new platform after
// OPS51 (municipality 122 gained advisor 5 and lost stateDeputies 53/58 — a
// legitimate post-migration edit, not orphaned data). Anything outside this
// explicit set still fails the reconcile.
const ABSOLVED_MUNICIPALITY_RELS = new Set([
  '122|stateDeputies|53',
  '122|stateDeputies|58',
  '122|advisors|5',
])

const results = []
const report = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}: ${detail}`)
}

const connectReadOnly = async (url) => {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 15_000 })
  await client.connect()
  await client.query('SET default_transaction_read_only = on')
  await client.query('SET statement_timeout = 30000')
  return client
}

const fetchIds = async (client, table) => {
  const res = await client.query(`SELECT id FROM "${table}" ORDER BY id`)
  return res.rows.map((r) => String(r.id))
}

// Joins each rel row to its child id. Payload rel tables use a per-parent
// polymorphic FK; we normalise to (parent, path, child) so semantically equal
// relationships are comparable even when Payload churn changes row ids. The
// child id lives in whichever `<relation>_id` column is set for the path — the
// column set is introspected per table (they differ: municipality_rels has
// campaign_user_id/state_deputy_id, leadership_rels has municipalities_id, …).
async function fetchRels(client, table) {
  const { rows: cols } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name LIKE '%\\_id'`,
    [table],
  )
  const childCandidates = cols
    .map((c) => c.column_name)
    .filter((c) => !['parent_id'].includes(c))
    .map((c) => `"${c}"::text`)
  if (childCandidates.length === 0) throw new Error(`sem colunas *_id em ${table}`)
  const childExpr = `COALESCE(${childCandidates.join(', ')}, '')`
  const res = await client.query(
    `SELECT parent_id::text AS parent, path, ${childExpr} AS child
       FROM "${table}"`,
  )
  return res.rows.map((r) => `${r.parent}|${r.path}|${r.child}`)
}

async function main() {
  console.log(`[ops79:reconcile] Neon  : ${new URL(NEON_DATABASE_URL).host}`)
  console.log(`[ops79:reconcile] Target: ${new URL(TARGET_DATABASE_URL).host}`)

  const neon = await connectReadOnly(NEON_DATABASE_URL)
  const target = await connectReadOnly(TARGET_DATABASE_URL)
  console.log(`[ops79:reconcile] conexões read-only OK`)

  for (const table of CORE_TABLES) {
    const neonIds = await fetchIds(neon, table)
    const targetIds = await fetchIds(target, table)
    const neonSet = new Set(neonIds)
    const targetSet = new Set(targetIds)
    const neonOnly = neonIds.filter((id) => !targetSet.has(id))
    const targetOnly = targetIds.filter((id) => !neonSet.has(id))
    report(
      table,
      neonOnly.length === 0 && targetOnly.length === 0,
      `counts ${neonIds.length}=${targetIds.length}; neon_only=${neonOnly.length} target_only=${targetOnly.length}`,
    )
  }

  for (const table of REL_TABLES) {
    const neonRels = await fetchRels(neon, table)
    const targetRels = await fetchRels(target, table)
    const neonSet = new Set(neonRels)
    const targetSet = new Set(targetRels)
    const absolved = table === 'municipality_rels' ? ABSOLVED_MUNICIPALITY_RELS : new Set()
    const neonOnly = neonRels.filter((r) => !targetSet.has(r) && !absolved.has(r))
    const targetOnly = targetRels.filter((r) => !neonSet.has(r) && !absolved.has(r))
    const absolvedHits = [...absolved].filter((r) => neonSet.has(r) || targetSet.has(r)).length
    const ok = neonOnly.length === 0 && targetOnly.length === 0
    const detail = `rels ${neonRels.length}=${targetRels.length}; neon_only=${neonOnly.length} target_only=${targetOnly.length}`
    report(
      table,
      ok,
      absolvedHits > 0 ? `${detail} (+${absolvedHits} absorvida pós-OPS51)` : detail,
    )
  }

  await neon.end()
  await target.end()

  const failures = results.filter((r) => !r.ok)
  console.log(
    `\n[ops79:reconcile] ${results.length - failures.length}/${results.length} PASS` +
      (failures.length > 0 ? `; ${failures.length} FAIL` : ''),
  )
  process.exit(failures.length > 0 ? 1 : 0)
}

main().catch((err) => {
  die(err?.message || String(err))
})
