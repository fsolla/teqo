/**
 * Benchmark the staff ops snapshot (OH3/OH4+) — uses the canonical
 * `buildOpsSnapshot` builder so selects/mappers never drift from
 * `GET /campanha/api/ops-sync`. Reports per-collection row counts, JSON
 * bytes, gzip bytes and query time; supports measuring `municipality_update`
 * truncation via `--rows municipality_update=N`.
 *
 * Safety: read-only against the LOCAL database (`assertLocalDatabase` guard).
 * Never run against Neon without the explicit ALLOW_REMOTE_DB escape hatch.
 *
 * Usage:
 *   pnpm benchmark:ops-snapshot
 *   pnpm benchmark:ops-snapshot -- --rows municipality_update=50
 *
 * Prerequisite: `pnpm migrate && pnpm db:seed:minimal` (coordinator actor).
 */

import { performance } from 'node:perf_hooks'
import { gzipSync } from 'node:zlib'
import { getPayload } from 'payload'

import { assertLocalDatabase } from './assert-local-database.mjs'
import { dieWithLabel, loadCliEnv } from './lib/cli.mjs'

loadCliEnv()

const LABEL = 'benchmark:ops-snapshot'
const die = dieWithLabel(LABEL)

assertLocalDatabase(
  LABEL,
  'This script only reads the local campaign database for snapshot sizing.',
)

const { serializeOpsSnapshot } = await import('../src/lib/campaignOps/opsContract.ts')
const {
  OPS_MUNICIPALITY_UPDATE_LIMIT_PER_MUNICIPALITY,
  OPS_SNAPSHOT_GZIP_TARGET_BYTES,
  OPS_SNAPSHOT_PROD_GZIP_RATIO_ESTIMATE,
  OPS_SNAPSHOT_PROD_MEASURED_JSON_BYTES,
} = await import('../src/lib/campaignOps/opsSnapshotPolicy.ts')
const { buildOpsSnapshot } = await import('../src/utilities/campaignOps/buildOpsSnapshot.ts')
const { MINIMAL_CAMPAIGN_USERS } = await import('./lib/seed-minimal-manifest.mjs')

const payloadConfig = (await import('../src/payload.config.ts')).default

const COORDINATOR_EMAIL =
  MINIMAL_CAMPAIGN_USERS.find((user) => user.role === 'coordinator')?.email ??
  'seed-coordenador@teqo.invalid'

/** Prod row estimates for projection (2026-08-01 ops-hibrido spec + campaign scale). */
const PROD_ROW_ESTIMATES = {
  municipalities: 435,
  leaderships: 1_200,
  votePledges: 6_000,
  activities: 900,
  stateDeputies: 40,
  organizations: 250,
  demands: 400,
}

/**
 * Measured prod JSON size (2026-08-01, ops-hibrido spec) — anchor for projection sanity.
 * @see docs/plans/ops-hibrido-rsc-local-spec.md
 */
const PROD_MEASURED_JSON_BYTES = OPS_SNAPSHOT_PROD_MEASURED_JSON_BYTES

/** Conservative gzip ratio for prod ops JSON (text-heavy updates; not the sparse-local 6%). */
const PROD_GZIP_RATIO_ESTIMATE = OPS_SNAPSHOT_PROD_GZIP_RATIO_ESTIMATE

const GZIP_TARGET_BYTES = OPS_SNAPSHOT_GZIP_TARGET_BYTES

/**
 * Fallback bytes/row when the minimal seed has no rows (local cannot extrapolate).
 * Derived from prod ~4 MB minus ~200 kB municipalities, spread over estimated row counts.
 */
const PROD_FALLBACK_BYTES_PER_ROW = {
  leaderships: 420,
  votePledges: 180,
  activities: 520,
  stateDeputies: 140,
  organizations: 190,
  demands: 360,
  municipalityUpdates: 95,
  goals: 100,
}

const parseCliArgs = (argv) => {
  /** @type {Record<string, number>} */
  const rowLimits = { municipality_update: OPS_MUNICIPALITY_UPDATE_LIMIT_PER_MUNICIPALITY }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    let pair = null

    if (arg === '--rows') {
      pair = argv[index + 1]
      if (!pair) die('Missing value after --rows (expected municipality_update=50)')
      index += 1
    } else if (arg.startsWith('--rows=')) {
      pair = arg.slice('--rows='.length)
    }

    if (!pair) continue

    const [key, rawValue] = pair.split('=')
    if (!key || rawValue === undefined) {
      die(`Invalid --rows argument "${pair}". Expected municipality_update=50`)
    }
    const value = Number.parseInt(rawValue, 10)
    if (!Number.isFinite(value) || value < 0) {
      die(`Invalid row limit for "${key}": ${rawValue}`)
    }
    rowLimits[key] = value
  }

  return rowLimits
}

/** @param {import('payload').Payload} payload */
const loadCoordinatorActor = async (payload) => {
  const result = await payload.find({
    collection: 'campaignUser',
    where: { email: { equals: COORDINATOR_EMAIL } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })

  const doc = result.docs[0]
  if (!doc) {
    die(
      `Coordinator user "${COORDINATOR_EMAIL}" not found. Run: pnpm migrate && pnpm db:seed:minimal`,
    )
  }

  return { ...doc, collection: 'campaignUser' }
}

const measureJson = (value) => {
  const json = typeof value === 'string' ? value : JSON.stringify(value)
  const gzip = gzipSync(json)
  return { jsonBytes: Buffer.byteLength(json, 'utf8'), gzipBytes: gzip.length }
}

const formatBytes = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${bytes} B`
}

const formatMs = (ms) => `${ms.toFixed(1)} ms`

/**
 * @param {import('../src/lib/campaignOps/opsContract.ts').OpsSnapshot} snapshot
 * @param {import('../src/utilities/campaignOps/buildOpsSnapshot.ts').OpsSnapshotSectionTiming[]} timings
 */
const buildReportSections = (snapshot, timings) => {
  const timingByKey = new Map(timings.map((timing) => [timing.key, timing]))

  /** @type {Array<{ key: string; label: string; rows: number; jsonBytes: number; gzipBytes: number; queryMs: number; truncatedFrom?: number }>} */
  const sections = []

  const addSection = (key, value) => {
    const timing = timingByKey.get(key)
    const size = measureJson(value)
    sections.push({
      key,
      label: timing?.label ?? key,
      rows: timing?.rows ?? (Array.isArray(value) ? value.length : value ? 1 : 0),
      ...size,
      queryMs: timing?.queryMs ?? 0,
      ...(timing?.truncatedFrom !== undefined ? { truncatedFrom: timing.truncatedFrom } : {}),
    })
  }

  addSection('municipalities', snapshot.municipalities)
  addSection('leaderships', snapshot.leaderships)
  addSection('votePledges', snapshot.votePledges)
  addSection('activities', snapshot.activities)
  addSection('stateDeputies', snapshot.stateDeputies)
  addSection('organizations', snapshot.organizations)
  addSection('demands', snapshot.demands)
  addSection('municipalityUpdates', snapshot.municipalityUpdates)
  addSection('goals', snapshot.goals)

  return sections
}

const projectProdSnapshot = (sections, rowLimits) => {
  const MIN_ROWS_FOR_MEASURED_RATE = 5

  const bytesPerRow = Object.fromEntries(
    sections.map((section) => {
      if (section.rows >= MIN_ROWS_FOR_MEASURED_RATE) {
        return [section.key, section.jsonBytes / section.rows]
      }
      return [section.key, PROD_FALLBACK_BYTES_PER_ROW[section.key] ?? 0]
    }),
  )

  const projectedRows = {
    municipalities: PROD_ROW_ESTIMATES.municipalities,
    leaderships: PROD_ROW_ESTIMATES.leaderships,
    votePledges: PROD_ROW_ESTIMATES.votePledges,
    activities: PROD_ROW_ESTIMATES.activities,
    stateDeputies: PROD_ROW_ESTIMATES.stateDeputies,
    organizations: PROD_ROW_ESTIMATES.organizations,
    demands: PROD_ROW_ESTIMATES.demands,
    municipalityUpdates: PROD_ROW_ESTIMATES.municipalities * rowLimits.municipality_update,
    goals: 1,
  }

  let projectedJsonBytes = 0
  for (const [key, rows] of Object.entries(projectedRows)) {
    projectedJsonBytes += Math.round((bytesPerRow[key] ?? 0) * rows)
  }

  // Envelope overhead (revisedAt, schemaVersion, key names) — ~2% measured on local runs.
  projectedJsonBytes = Math.round(projectedJsonBytes * 1.02)

  const localGzipRatio =
    sections.reduce((sum, section) => sum + section.jsonBytes, 0) > 0
      ? sections.reduce((sum, section) => sum + section.gzipBytes, 0) /
        sections.reduce((sum, section) => sum + section.jsonBytes, 0)
      : PROD_GZIP_RATIO_ESTIMATE

  const prodMeasuredGzipEstimate = Math.round(PROD_MEASURED_JSON_BYTES * PROD_GZIP_RATIO_ESTIMATE)

  return { projectedRows, projectedJsonBytes, prodMeasuredGzipEstimate, localGzipRatio }
}

const printReport = (sections, totalSize, totalQueryMs, rowLimits, projection) => {
  const header = ['collection', 'rows', 'json', 'gzip', 'query']
  const divider = header.map(() => '---')
  const lines = [
    '',
    `[${LABEL}] Ops snapshot benchmark (coordinator, overrideAccess: false, buildOpsSnapshot)`,
    `[${LABEL}] municipality_update truncation: ${rowLimits.municipality_update} per municipality`,
    '',
    `| ${header.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
  ]

  for (const section of sections) {
    const rowLabel =
      section.truncatedFrom !== undefined && section.truncatedFrom !== section.rows
        ? `${section.rows} (of ${section.truncatedFrom})`
        : String(section.rows)
    lines.push(
      `| ${section.label} | ${rowLabel} | ${formatBytes(section.jsonBytes)} | ${formatBytes(section.gzipBytes)} | ${formatMs(section.queryMs)} |`,
    )
  }

  lines.push(
    `| **total** | — | **${formatBytes(totalSize.jsonBytes)}** | **${formatBytes(totalSize.gzipBytes)}** | **${formatMs(totalQueryMs)}** |`,
    '',
    `[${LABEL}] Truncation policy: keep the latest ${rowLimits.municipality_update} municipality_update rows per municipality (sorted by updatedAt desc).`,
    `[${LABEL}] Gzip target: ≤ ${formatBytes(GZIP_TARGET_BYTES)} (ops-hibrido spec).`,
    '',
    `[${LABEL}] Prod projection (row estimates × bytes/row; sparse collections use fallbacks):`,
    `  - leaderships: ${projection.projectedRows.leaderships}`,
    `  - vote_pledges: ${projection.projectedRows.votePledges}`,
    `  - activities: ${projection.projectedRows.activities}`,
    `  - municipality_updates (truncated): ${projection.projectedRows.municipalityUpdates}`,
    `  - projected JSON (model): ~${formatBytes(projection.projectedJsonBytes)}`,
    `  - prod measured JSON (2026-08-01): ~${formatBytes(PROD_MEASURED_JSON_BYTES)}`,
    `  - prod gzip estimate (${(PROD_GZIP_RATIO_ESTIMATE * 100).toFixed(0)}% ratio): ~${formatBytes(projection.prodMeasuredGzipEstimate)}`,
    `  - local gzip ratio (sparse seed): ${(projection.localGzipRatio * 100).toFixed(0)}% — not representative of prod text`,
    '',
  )

  const gzipDecisionBytes = projection.prodMeasuredGzipEstimate

  if (gzipDecisionBytes > GZIP_TARGET_BYTES) {
    lines.push(
      `[${LABEL}] WARN: prod gzip estimate exceeds target — revisit truncation or DTO select before OH4.`,
    )
  } else {
    lines.push(
      `[${LABEL}] OK: prod gzip estimate ~${formatBytes(gzipDecisionBytes)} within ≤ ${formatBytes(GZIP_TARGET_BYTES)} target with municipality_update=${rowLimits.municipality_update}/municipality.`,
    )
  }

  console.log(lines.join('\n'))
}

const rowLimits = parseCliArgs(process.argv.slice(2))
const payload = await getPayload({ config: payloadConfig })
const actor = await loadCoordinatorActor(payload)

/** @type {import('../src/utilities/campaignOps/buildOpsSnapshot.ts').OpsSnapshotSectionTiming[]} */
const sectionTimings = []

const buildStarted = performance.now()
const snapshot = await buildOpsSnapshot(payload, actor, {
  municipalityUpdateLimit: rowLimits.municipality_update,
  onSectionLoaded: (section) => {
    sectionTimings.push(section)
  },
})
const buildElapsedMs = performance.now() - buildStarted

const sections = buildReportSections(snapshot, sectionTimings)
const totalSize = measureJson(serializeOpsSnapshot(snapshot))
const totalQueryMs = buildElapsedMs
const projection = projectProdSnapshot(sections, rowLimits)

printReport(sections, totalSize, totalQueryMs, rowLimits, projection)

process.exit(0)
