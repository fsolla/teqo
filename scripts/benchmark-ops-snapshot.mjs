/**
 * Benchmark the staff ops snapshot (OH3) — same collections and DTO shape that
 * `buildOpsSnapshot` will ship in OH4. Reports per-collection row counts, JSON
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

import { gzipSync } from 'node:zlib'
import { performance } from 'node:perf_hooks'
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

const { OPS_MIRROR_SCHEMA_VERSION } = await import('../src/lib/campaignOps/opsMirrorVersion.ts')
const { relationshipId, uniqueRelationshipIds } = await import('../src/lib/relationship.ts')

const payloadConfig = (await import('../src/payload.config.ts')).default

/** @typedef {import('../src/lib/campaignOps/opsContract.ts').OpsSnapshot} OpsSnapshot */

const COORDINATOR_EMAIL = 'seed-coordenador@teqo.invalid'

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
const PROD_MEASURED_JSON_BYTES = 4 * 1024 * 1024

/** Conservative gzip ratio for prod ops JSON (text-heavy updates; not the sparse-local 6%). */
const PROD_GZIP_RATIO_ESTIMATE = 0.5

const GZIP_TARGET_BYTES = 2 * 1024 * 1024

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
  const rowLimits = { municipality_update: 50 }

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

const toIso = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return String(value)
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

const mapMunicipality = (doc) => ({
  id: doc.id,
  name: doc.name,
  slug: doc.slug,
  kind: doc.kind,
  city: doc.city,
  region: doc.region,
  ibgeCode: doc.ibgeCode,
  zoneNumber: doc.zoneNumber ?? null,
  advisors: uniqueRelationshipIds(doc.advisors),
  priority: doc.priority ?? null,
  engagementLevel: doc.engagementLevel ?? null,
  levelNote: doc.levelNote ?? null,
  levelChangedAt: toIso(doc.levelChangedAt),
  expectedVotes: doc.expectedVotes ?? null,
  politicalTrend: doc.politicalTrend
    ? {
        status: doc.politicalTrend.status ?? null,
        note: doc.politicalTrend.note ?? null,
        recordedBy: relationshipId(doc.politicalTrend.recordedBy),
        recordedAt: toIso(doc.politicalTrend.recordedAt),
      }
    : null,
  stateDeputies: uniqueRelationshipIds(doc.stateDeputies),
  lastUpdateAt: toIso(doc.lastUpdateAt),
  updatedAt: toIso(doc.updatedAt),
})

const mapLeadershipContact = (contact) => {
  if (typeof contact !== 'object' || contact === null) {
    return { id: relationshipId(contact) ?? 0, name: 'Contato' }
  }
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone ?? null,
  }
}

const mapLeadership = (doc) => ({
  id: doc.id,
  contact: mapLeadershipContact(doc.contact),
  municipalities: uniqueRelationshipIds(doc.municipalities),
  organizations: uniqueRelationshipIds(doc.organizations),
  stateDeputies: uniqueRelationshipIds(doc.stateDeputies),
  exclusive: doc.exclusive ?? null,
  supportStatus: doc.supportStatus,
  notes: doc.notes ?? null,
  updatedAt: toIso(doc.updatedAt),
})

const mapVotePledge = (doc) => ({
  id: doc.id,
  leadership: relationshipId(doc.leadership),
  municipality: relationshipId(doc.municipality),
  declaredVotes: doc.declaredVotes,
  declaredAt: toIso(doc.declaredAt),
  declaredBy: relationshipId(doc.declaredBy),
  estimatedVotes: doc.estimatedVotes ?? null,
  estimateNote: doc.estimateNote ?? null,
  estimatedBy: relationshipId(doc.estimatedBy),
  estimatedAt: toIso(doc.estimatedAt),
  updatedAt: toIso(doc.updatedAt),
})

const mapActivity = (doc) => ({
  id: doc.id,
  title: doc.title,
  slug: doc.slug,
  kind: doc.kind,
  status: doc.status,
  deputyPresent: doc.deputyPresent ?? null,
  startAt: toIso(doc.startAt),
  endAt: toIso(doc.endAt),
  municipality: relationshipId(doc.municipality),
  locality: doc.locality ?? null,
  organizations: uniqueRelationshipIds(doc.organizations),
  advisors: uniqueRelationshipIds(doc.advisors),
  leadership: relationshipId(doc.leadership),
  taskTotal: doc.taskTotal ?? null,
  taskDoneCount: doc.taskDoneCount ?? null,
  updatedAt: toIso(doc.updatedAt),
})

const mapStateDeputy = (doc) => ({
  id: doc.id,
  name: doc.name,
  slug: doc.slug,
  party: doc.party ?? null,
  notes: doc.notes ?? null,
  updatedAt: toIso(doc.updatedAt),
})

const mapOrganization = (doc) => ({
  id: doc.id,
  name: doc.name,
  slug: doc.slug,
  kind: doc.kind,
  municipalities: uniqueRelationshipIds(doc.municipalities),
  notes: doc.notes ?? null,
  updatedAt: toIso(doc.updatedAt),
})

const mapDemand = (doc) => ({
  id: doc.id,
  title: doc.title,
  slug: doc.slug,
  kind: doc.kind,
  municipality: relationshipId(doc.municipality),
  activity: relationshipId(doc.activity),
  leadership: relationshipId(doc.leadership),
  status: doc.status,
  updatedAt: toIso(doc.updatedAt),
})

const mapMunicipalityUpdate = (doc) => ({
  id: doc.id,
  municipality: relationshipId(doc.municipality),
  author: relationshipId(doc.author),
  kind: doc.kind,
  body: doc.body ?? null,
  signalType: doc.signalType ?? null,
  updatedAt: toIso(doc.updatedAt),
  createdAt: toIso(doc.createdAt),
})

const mapGoals = (doc) =>
  doc
    ? {
        stateGoal: doc.stateGoal,
        margin: doc.margin ?? null,
        baseYear: doc.baseYear ?? null,
        note: doc.note ?? null,
        updatedAt: toIso(doc.updatedAt),
      }
    : null

/**
 * @param {Array<{ municipality: number; updatedAt: string }>} updates
 * @param {number} limitPerMunicipality
 */
const truncateMunicipalityUpdates = (updates, limitPerMunicipality) => {
  if (limitPerMunicipality <= 0) return []

  /** @type {Map<number, typeof updates>} */
  const byMunicipality = new Map()

  for (const update of updates) {
    const bucket = byMunicipality.get(update.municipality) ?? []
    bucket.push(update)
    byMunicipality.set(update.municipality, bucket)
  }

  const kept = []
  for (const bucket of byMunicipality.values()) {
    bucket.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    kept.push(...bucket.slice(0, limitPerMunicipality))
  }

  return kept
}

const measureJson = (value) => {
  const json = JSON.stringify(value)
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
 * @param {import('payload').Payload} payload
 * @param {object} actor
 */
const timedFindAll = async (payload, actor, collection, options = {}) => {
  const started = performance.now()
  const result = await payload.find({
    collection,
    depth: options.depth ?? 0,
    pagination: false,
    user: actor,
    overrideAccess: false,
    select: options.select,
    sort: options.sort,
  })
  const elapsedMs = performance.now() - started
  return { docs: result.docs, elapsedMs }
}

const buildSnapshotSections = async (payload, actor, rowLimits) => {
  /** @type {Array<{ key: string; label: string; rows: number; jsonBytes: number; gzipBytes: number; queryMs: number }>} */
  const sections = []

  const municipalitiesResult = await timedFindAll(payload, actor, 'municipality', {
    select: {
      name: true,
      slug: true,
      kind: true,
      city: true,
      region: true,
      ibgeCode: true,
      zoneNumber: true,
      advisors: true,
      priority: true,
      engagementLevel: true,
      levelNote: true,
      levelChangedAt: true,
      expectedVotes: true,
      politicalTrend: true,
      stateDeputies: true,
      lastUpdateAt: true,
      updatedAt: true,
    },
  })
  const municipalities = municipalitiesResult.docs.map(mapMunicipality)
  const municipalitiesSize = measureJson(municipalities)
  sections.push({
    key: 'municipalities',
    label: 'municipality',
    rows: municipalities.length,
    ...municipalitiesSize,
    queryMs: municipalitiesResult.elapsedMs,
  })

  const leadershipsResult = await timedFindAll(payload, actor, 'leadership', {
    depth: 1,
    select: {
      contact: true,
      municipalities: true,
      organizations: true,
      stateDeputies: true,
      exclusive: true,
      supportStatus: true,
      notes: true,
      updatedAt: true,
    },
  })
  const leaderships = leadershipsResult.docs.map(mapLeadership)
  const leadershipsSize = measureJson(leaderships)
  sections.push({
    key: 'leaderships',
    label: 'leadership',
    rows: leaderships.length,
    ...leadershipsSize,
    queryMs: leadershipsResult.elapsedMs,
  })

  const votePledgesResult = await timedFindAll(payload, actor, 'votePledge', {
    select: {
      leadership: true,
      municipality: true,
      declaredVotes: true,
      declaredAt: true,
      declaredBy: true,
      estimatedVotes: true,
      estimateNote: true,
      estimatedBy: true,
      estimatedAt: true,
      updatedAt: true,
    },
  })
  const votePledges = votePledgesResult.docs.map(mapVotePledge)
  const votePledgesSize = measureJson(votePledges)
  sections.push({
    key: 'votePledges',
    label: 'vote_pledge',
    rows: votePledges.length,
    ...votePledgesSize,
    queryMs: votePledgesResult.elapsedMs,
  })

  const activitiesResult = await timedFindAll(payload, actor, 'activity', {
    select: {
      title: true,
      slug: true,
      kind: true,
      status: true,
      deputyPresent: true,
      startAt: true,
      endAt: true,
      municipality: true,
      locality: true,
      organizations: true,
      advisors: true,
      leadership: true,
      taskTotal: true,
      taskDoneCount: true,
      updatedAt: true,
    },
  })
  const activities = activitiesResult.docs.map(mapActivity)
  const activitiesSize = measureJson(activities)
  sections.push({
    key: 'activities',
    label: 'activity',
    rows: activities.length,
    ...activitiesSize,
    queryMs: activitiesResult.elapsedMs,
  })

  const stateDeputiesResult = await timedFindAll(payload, actor, 'stateDeputy', {
    select: {
      name: true,
      slug: true,
      party: true,
      notes: true,
      updatedAt: true,
    },
  })
  const stateDeputies = stateDeputiesResult.docs.map(mapStateDeputy)
  const stateDeputiesSize = measureJson(stateDeputies)
  sections.push({
    key: 'stateDeputies',
    label: 'state_deputy',
    rows: stateDeputies.length,
    ...stateDeputiesSize,
    queryMs: stateDeputiesResult.elapsedMs,
  })

  const organizationsResult = await timedFindAll(payload, actor, 'organization', {
    select: {
      name: true,
      slug: true,
      kind: true,
      municipalities: true,
      notes: true,
      updatedAt: true,
    },
  })
  const organizations = organizationsResult.docs.map(mapOrganization)
  const organizationsSize = measureJson(organizations)
  sections.push({
    key: 'organizations',
    label: 'organization',
    rows: organizations.length,
    ...organizationsSize,
    queryMs: organizationsResult.elapsedMs,
  })

  const demandsResult = await timedFindAll(payload, actor, 'campaignDemand', {
    select: {
      title: true,
      slug: true,
      kind: true,
      municipality: true,
      activity: true,
      leadership: true,
      status: true,
      updatedAt: true,
    },
  })
  const demands = demandsResult.docs.map(mapDemand)
  const demandsSize = measureJson(demands)
  sections.push({
    key: 'demands',
    label: 'campaign_demand',
    rows: demands.length,
    ...demandsSize,
    queryMs: demandsResult.elapsedMs,
  })

  const updatesResult = await timedFindAll(payload, actor, 'municipalityUpdate', {
    select: {
      municipality: true,
      author: true,
      kind: true,
      body: true,
      signalType: true,
      updatedAt: true,
      createdAt: true,
    },
    sort: '-updatedAt',
  })
  const allUpdates = updatesResult.docs.map(mapMunicipalityUpdate)
  const municipalityUpdates = truncateMunicipalityUpdates(
    allUpdates,
    rowLimits.municipality_update,
  )
  const municipalityUpdatesSize = measureJson(municipalityUpdates)
  sections.push({
    key: 'municipalityUpdates',
    label: 'municipality_update',
    rows: municipalityUpdates.length,
    ...municipalityUpdatesSize,
    queryMs: updatesResult.elapsedMs,
    truncatedFrom: allUpdates.length,
  })

  const goalsStarted = performance.now()
  const goalsDoc = await payload.findGlobal({
    slug: 'campaignGoals',
    depth: 0,
    user: actor,
    overrideAccess: false,
  })
  const goalsElapsedMs = performance.now() - goalsStarted
  const goals = mapGoals(goalsDoc)
  const goalsSize = measureJson(goals)
  sections.push({
    key: 'goals',
    label: 'campaign_goals',
    rows: goals ? 1 : 0,
    ...goalsSize,
    queryMs: goalsElapsedMs,
  })

  const revisedAt = new Date().toISOString()
  /** @type {OpsSnapshot} */
  const snapshot = {
    revisedAt,
    schemaVersion: OPS_MIRROR_SCHEMA_VERSION,
    municipalities,
    leaderships,
    votePledges,
    activities,
    stateDeputies,
    organizations,
    demands,
    municipalityUpdates,
    goals,
  }

  const totalSize = measureJson(snapshot)
  const totalQueryMs = sections.reduce((sum, section) => sum + section.queryMs, 0)

  return { snapshot, sections, totalSize, totalQueryMs }
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
    municipalityUpdates:
      PROD_ROW_ESTIMATES.municipalities * rowLimits.municipality_update,
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

  const estimatedGzipBytes = Math.round(projectedJsonBytes * PROD_GZIP_RATIO_ESTIMATE)
  const prodMeasuredGzipEstimate = Math.round(
    PROD_MEASURED_JSON_BYTES * PROD_GZIP_RATIO_ESTIMATE,
  )

  return {
    projectedRows,
    projectedJsonBytes,
    estimatedGzipBytes,
    localGzipRatio,
    prodMeasuredGzipEstimate,
  }
}

const printReport = (sections, totalSize, totalQueryMs, rowLimits, projection) => {
  const header = ['collection', 'rows', 'json', 'gzip', 'query']
  const divider = header.map(() => '---')
  const lines = [
    '',
    `[${LABEL}] Ops snapshot benchmark (coordinator, overrideAccess: false)`,
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
const { sections, totalSize, totalQueryMs } = await buildSnapshotSections(
  payload,
  actor,
  rowLimits,
)
const projection = projectProdSnapshot(sections, rowLimits)

printReport(sections, totalSize, totalQueryMs, rowLimits, projection)

process.exit(0)
