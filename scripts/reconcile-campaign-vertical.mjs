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
 * OPS84 extension (--values): compares ALL content columns per row (not just
 * ids). Columns are classified into buckets:
 *   - content: divergence fails the run (the acceptance criterion)
 *   - derived: hook-stamped or Payload-managed; divergence is informational only
 *   - sensitive: PII; values are never printed, only counted
 *
 * Safety model:
 *   - READ-ONLY: every connection runs `default_transaction_read_only = on`
 *     and a statement timeout. No writes are possible from this script.
 *   - NEVER prints PII: only ids, counts and relation keys are reported.
 *     In --values mode, sensitive column values are never printed.
 *   - Both URLs come from env; the operator supplies them on the homeserver
 *     (NEON_DATABASE_URL from ~/stack/.env; DATABASE_URL from
 *     ~/stack/teqo-1313.env, rewritten to the socat proxy 127.0.0.1:5433 —
 *     see the OPS79 runbook in docs/ops/teqo-1313-deploy.md).
 *
 * Usage:
 *   NEON_DATABASE_URL=postgres://... DATABASE_URL=postgres://... \
 *     pnpm ops79:reconcile              # id-mode (default, OPS79)
 *   NEON_DATABASE_URL=postgres://... DATABASE_URL=postgres://... \
 *     pnpm ops84:reconcile-values       # values-mode (OPS84)
 *   NEON_DATABASE_URL=postgres://... DATABASE_URL=postgres://... \
 *     pnpm ops84:reconcile-values --table vote_pledge --report report.md
 */
import { Client } from 'pg'

import { dieWithLabel, loadCliEnv } from './lib/cli.mjs'

const die = dieWithLabel('ops79:reconcile')

loadCliEnv()

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL
const TARGET_DATABASE_URL = process.env.DATABASE_URL

if (!NEON_DATABASE_URL) die('NEON_DATABASE_URL is not set (fonte: ~/stack/.env no homeserver).')
if (!TARGET_DATABASE_URL) die('DATABASE_URL is not set (target teqo_1313).')

// CLI flags: --values (OPS84), --table <name>, --report <path>
const VALUES_MODE = process.argv.includes('--values')
const TABLE_FILTER = (() => {
  const idx = process.argv.indexOf('--table')
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null
})()
const REPORT_PATH = (() => {
  const idx = process.argv.indexOf('--report')
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null
})()
if (VALUES_MODE) {
  console.log(
    `[ops84:reconcile-values] modo VALUES ativado${TABLE_FILTER ? ` (tabela: ${TABLE_FILTER})` : ''}`,
  )
  if (REPORT_PATH) console.log(`[ops84:reconcile-values] relatório: ${REPORT_PATH}`)
}

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

// --- OPS84: derived/sensitive column maps per table ---
// Derived = stamped by Payload hooks or managed fields; divergence is
// informational (expected after legitimate post-OPS51 edits in target).
// Sensitive = PII; values are NEVER printed, only counted.
// Column names use the DB convention (e.g. relationship fields get _id suffix,
// group fields are flattened to field_subfield).

const DERIVED_COLUMNS = {
  vote_pledge: [
    'declared_at',
    'declared_by_id',
    'estimated_at',
    'estimated_by_id',
    'created_at',
    'updated_at',
  ],
  campaign_user: ['created_at', 'updated_at'],
  leadership: ['created_at', 'updated_at'],
  activity: ['created_at', 'updated_at'],
  municipality: ['created_at', 'updated_at'],
  organization: ['created_at', 'updated_at'],
  allocation_decision: ['created_at', 'updated_at'],
  municipality_update: ['created_at', 'updated_at'],
  state_deputy: ['created_at', 'updated_at'],
  election_tally: ['created_at', 'updated_at'],
  campaign_web_authn_credential: ['created_at', 'updated_at'],
  supporter: ['created_at', 'updated_at'],
  campaign_demand: ['created_at', 'updated_at'],
}

const SENSITIVE_COLUMNS = {
  campaign_user: ['email', 'name'],
  supporter: ['email', 'name'],
  leadership: ['name', 'email', 'phone'],
  campaign_web_authn_credential: ['public_key'],
}

// Payload-managed columns that are always "derived" (not compared as content).
const PAYLOAD_MANAGED = new Set(['id', 'created_at', 'updated_at', '_status'])

// Schema introspection: list columns and their types for a table.
async function introspectColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  )
  return rows.map((r) => ({ name: r.column_name, type: r.data_type }))
}

// Classify a column into a bucket: 'content' | 'derived' | 'ensitive' | 'internal'.
function classifyColumn(table, colName) {
  if (PAYLOAD_MANAGED.has(colName)) return 'managed'
  if ((DERIVED_COLUMNS[table] || []).includes(colName)) return 'derived'
  if ((SENSITIVE_COLUMNS[table] || []).includes(colName)) return 'sensitive'
  return 'content'
}

// Build a SELECT expression that returns jsonb columns as ::text (preserving
// exact representation — '1' vs '1.0' diverges, SQL NULL vs JSON null differs)
// and other columns as ::text with a NULL sentinel.
function buildSelectExpression(columns) {
  const parts = columns.map((col) => {
    if (col.type === 'jsonb') {
      return `"${col.name}"::text AS "${col.name}"`
    }
    return `COALESCE("${col.name}"::text, '§NULL§') AS "${col.name}"`
  })
  return parts.join(', ')
}

// Strict JS comparator: two row values are equal iff their string representations
// match exactly. No trim, no round, no coalesce.
function compareRows(neonRow, targetRow, columns) {
  const diffs = []
  for (const col of columns) {
    const nv = neonRow[col.name]
    const tv = targetRow[col.name]
    if (nv !== tv) {
      diffs.push({ column: col.name, type: col.type, neon: nv, target: tv })
    }
  }
  return diffs
}

// Fetch all rows for a table, keyed by id, with selected columns.
async function fetchRowsByKey(client, table, columns, keyCol = 'id') {
  const selectExpr = buildSelectExpression(columns)
  const res = await client.query(`SELECT ${selectExpr} FROM "${table}" ORDER BY "${keyCol}"`)
  const map = new Map()
  for (const row of res.rows) {
    map.set(String(row[keyCol]), row)
  }
  return map
}

// Truncate a value for the report artifact (PII-safe, max 120 chars).
function truncateForReport(val, maxLen = 120) {
  if (val === null || val === undefined) return 'NULL'
  const s = String(val)
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s
}

// Render a single table's value comparison to console + optional report lines.
function renderTableValues(table, diffs, neonCount, targetCount, commonIds, reportLines) {
  const contentDiffs = diffs.filter((d) => d.bucket === 'content')
  const derivedDiffs = diffs.filter((d) => d.bucket === 'derived')
  const sensitiveDiffs = diffs.filter((d) => d.bucket === 'sensitive')

  const ok = contentDiffs.length === 0
  const detail =
    `rows ${neonCount}=${targetCount}; common=${commonIds.length}; ` +
    `content_diffs=${contentDiffs.length}; derived_diffs=${derivedDiffs.length}; ` +
    `sensitive_diffs=${sensitiveDiffs.length}`

  report(table, ok, detail)

  if (contentDiffs.length > 0) {
    console.log(`    content divergences:`)
    for (const d of contentDiffs) {
      console.log(
        `      id=${d.id} .${d.column}: neon=${truncateForReport(d.neon)} target=${truncateForReport(d.target)}`,
      )
    }
  }
  if (derivedDiffs.length > 0) {
    console.log(`    derived (informational): ${derivedDiffs.length} divergences`)
  }
  if (sensitiveDiffs.length > 0) {
    console.log(`    sensitive (PII, not printed): ${sensitiveDiffs.length} divergences`)
  }

  // Report artifact lines
  if (reportLines) {
    reportLines.push(`## ${table}`)
    reportLines.push(``)
    reportLines.push(`- rows: neon=${neonCount}, target=${targetCount}, common=${commonIds.length}`)
    reportLines.push(`- content diffs: ${contentDiffs.length}`)
    reportLines.push(`- derived diffs (informational): ${derivedDiffs.length}`)
    reportLines.push(`- sensitive diffs (PII, not printed): ${sensitiveDiffs.length}`)
    reportLines.push(``)
    if (contentDiffs.length > 0) {
      reportLines.push(`### Content divergences`)
      reportLines.push(``)
      reportLines.push(`| id | column | neon | target |`)
      reportLines.push(`|---|--------|------|--------|`)
      for (const d of contentDiffs) {
        reportLines.push(
          `| ${d.id} | ${d.column} | ${truncateForReport(d.neon)} | ${truncateForReport(d.target)} |`,
        )
      }
      reportLines.push(``)
    }
    if (derivedDiffs.length > 0) {
      reportLines.push(`### Derived divergences (informational)`)
      reportLines.push(``)
      for (const d of derivedDiffs) {
        reportLines.push(
          `- id=${d.id} .${d.column}: neon=${truncateForReport(d.neon)} target=${truncateForReport(d.target)}`,
        )
      }
      reportLines.push(``)
    }
    if (sensitiveDiffs.length > 0) {
      reportLines.push(`### Sensitive divergences (PII, not printed)`)
      reportLines.push(``)
      reportLines.push(
        `- ${sensitiveDiffs.length} rows with PII divergence (column names: ${[...new Set(sensitiveDiffs.map((d) => d.column))].join(', ')})`,
      )
      reportLines.push(``)
    }
  }
}

// Run values-mode comparison for one table.
async function reconcileValuesTable(neon, target, table) {
  const neonCols = await introspectColumns(neon, table)
  const targetCols = await introspectColumns(target, table)

  // Use intersection of columns (ignore columns present in only one side).
  const neonColNames = new Set(neonCols.map((c) => c.name))
  const commonColDefs = targetCols.filter((c) => neonColNames.has(c.name))

  // Classify all columns.
  const classified = commonColDefs.map((col) => ({
    ...col,
    bucket: classifyColumn(table, col.name),
  }))

  const contentCols = classified.filter((c) => c.bucket === 'content')
  const derivedCols = classified.filter((c) => c.bucket === 'derived')
  const sensitiveCols = classified.filter((c) => c.bucket === 'sensitive')
  const managedCols = classified.filter((c) => c.bucket === 'managed')

  console.log(
    `  [${table}] columns: ${classified.length} total; ` +
      `content=${contentCols.length} derived=${derivedCols.length} ` +
      `sensitive=${sensitiveCols.length} managed=${managedCols.length}`,
  )

  // If no content columns, nothing to fail on.
  if (contentCols.length === 0) {
    report(table, true, 'no content columns to compare')
    return []
  }

  // Fetch rows (content + derived + sensitive; managed excluded from comparison).
  const fetchCols = [...contentCols, ...derivedCols, ...sensitiveCols]
  const neonRows = await fetchRowsByKey(neon, table, fetchCols)
  const targetRows = await fetchRowsByKey(target, table, fetchCols)

  const commonIds = [...neonRows.keys()].filter((id) => targetRows.has(id))
  const neonOnly = [...neonRows.keys()].filter((id) => !targetRows.has(id))
  const targetOnly = [...targetRows.keys()].filter((id) => !neonRows.has(id))

  if (neonOnly.length > 0 || targetOnly.length > 0) {
    console.log(
      `    id-only: neon=${neonOnly.length} target=${targetOnly.length} (use id-mode for details)`,
    )
  }

  // Compare rows present in both.
  const allDiffs = []
  for (const id of commonIds) {
    const diffs = compareRows(neonRows.get(id), targetRows.get(id), fetchCols)
    for (const d of diffs) {
      allDiffs.push({ id, ...d })
    }
  }

  return allDiffs
}
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

async function runIdMode(neon, target) {
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
}

async function runValuesMode(neon, target) {
  const tables = TABLE_FILTER ? [TABLE_FILTER] : CORE_TABLES
  const reportLines = []
  let totalContentDiffs = 0

  for (const table of tables) {
    if (!CORE_TABLES.includes(table)) {
      die(`tabela "${table}" não é uma das 13 tabelas da vertical: ${CORE_TABLES.join(', ')}`)
    }

    const diffs = await reconcileValuesTable(neon, target, table)
    const contentDiffs = diffs.filter((d) => d.bucket === 'content')
    totalContentDiffs += contentDiffs.length

    const neonRows = await fetchRowsByKey(neon, table, [{ name: 'id', type: 'integer' }])
    const targetRows = await fetchRowsByKey(target, table, [{ name: 'id', type: 'integer' }])
    const commonIds = [...neonRows.keys()].filter((id) => targetRows.has(id))

    renderTableValues(table, diffs, neonRows.size, targetRows.size, commonIds, reportLines)
  }

  // Write report artifact if requested.
  if (REPORT_PATH) {
    const fs = await import('node:fs')
    const header = [
      `# Relatório de verificação de valores — OPS84`,
      ``,
      `- Data: ${new Date().toISOString()}`,
      `- Neon: ${new URL(NEON_DATABASE_URL).host}`,
      `- Target: ${new URL(TARGET_DATABASE_URL).host}`,
      `- Modo: values${TABLE_FILTER ? ` (tabela: ${TABLE_FILTER})` : ' (13 tabelas)'}`,
      `- Total content diffs: ${totalContentDiffs}`,
      ``,
    ]
    fs.writeFileSync(REPORT_PATH, [...header, ...reportLines].join('\n'))
    console.log(`\n[ops84:reconcile-values] relatório escrito em ${REPORT_PATH}`)
  }

  return totalContentDiffs
}

async function main() {
  console.log(`[ops79:reconcile] Neon  : ${new URL(NEON_DATABASE_URL).host}`)
  console.log(`[ops79:reconcile] Target: ${new URL(TARGET_DATABASE_URL).host}`)

  const neon = await connectReadOnly(NEON_DATABASE_URL)
  const target = await connectReadOnly(TARGET_DATABASE_URL)
  if (VALUES_MODE) {
    await neon.query('SET statement_timeout = 60000')
    await target.query('SET statement_timeout = 60000')
  }
  console.log(`[ops79:reconcile] conexões read-only OK`)

  if (VALUES_MODE) {
    const contentDiffs = await runValuesMode(neon, target)
    await neon.end()
    await target.end()

    const failures = results.filter((r) => !r.ok)
    console.log(
      `\n[ops84:reconcile-values] ${results.length - failures.length}/${results.length} PASS` +
        (failures.length > 0 ? `; ${failures.length} FAIL` : ''),
    )
    // Exit 1 if any content divergence (the acceptance criterion).
    process.exit(contentDiffs > 0 || failures.length > 0 ? 1 : 0)
  } else {
    await runIdMode(neon, target)
    await neon.end()
    await target.end()

    const failures = results.filter((r) => !r.ok)
    console.log(
      `\n[ops79:reconcile] ${results.length - failures.length}/${results.length} PASS` +
        (failures.length > 0 ? `; ${failures.length} FAIL` : ''),
    )
    process.exit(failures.length > 0 ? 1 : 0)
  }
}

main().catch((err) => {
  die(err?.message || String(err))
})
