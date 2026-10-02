/**
 * C248 — pure planning/reporting of the stored-grade thumbnail backfill: the
 * argv parser, the eligible-row filter, the probe/run summaries and the human
 * lines + JSON receipt. No I/O of its own: the object probe, the generation
 * and the Payload reads are injected by the CLI, so the unit spec drives
 * everything with fakes.
 */

import { parseIdList } from './cli.mjs'
import { formatArchiveBytes } from './flickrPlan.mjs'

const USAGE =
  'uso: `pnpm archive:thumbnails [--apply | --verify] [--only <ids>] [--limit <n>] [--concurrency <n>] [--out <dir>]`'

export const ARCHIVE_THUMBNAIL_DEFAULT_OUT_DIR = 'data/archive'

/**
 * The generation is bounded per process by the same 2-slot gate the web heal
 * uses (`MAX_CONCURRENT_GENERATIONS`), so a CLI concurrency above 2 would not
 * add parallel encodes; the default matches the real ceiling.
 */
export const ARCHIVE_THUMBNAIL_DEFAULT_CONCURRENCY = 2

export const archiveThumbnailReportStamp = (runAt) => String(runAt).replace(/[:.]/g, '-')

/**
 * `--only 80,83` → `[80, 83]` (photo ids, the row primary key). Exact digits
 * only: a typo must refuse the run, never silently widen or empty the selection.
 *
 * @param {string} value
 * @returns {number[]}
 */
export const parseArchiveThumbnailOnly = (value) => parseIdList({ value, usage: USAGE })

/**
 * `pnpm archive:thumbnails` argv parser — pure, so the unit spec pins it (the
 * CLI owns the exit and the help text). The default mode is the read-only
 * plan; `--apply` generates the missing grades and `--verify` checks the
 * coverage of the eligible rows. Errors carry the usage line.
 *
 * @param {string[]} [argv]
 * @returns {{ apply: boolean, verify: boolean, only: number[] | null, limit: number | null, concurrency: number, out: string, help: boolean }}
 */
export const parseArchiveThumbnailCliArgs = (argv = process.argv.slice(2)) => {
  const options = {
    apply: false,
    verify: false,
    only: null,
    limit: null,
    concurrency: ARCHIVE_THUMBNAIL_DEFAULT_CONCURRENCY,
    out: ARCHIVE_THUMBNAIL_DEFAULT_OUT_DIR,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => {
      const next = argv[++index]
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`faltou valor para ${arg} — ${USAGE}.`)
      }
      return next
    }
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--apply') options.apply = true
    else if (arg === '--verify') options.verify = true
    else if (arg === '--only') options.only = parseArchiveThumbnailOnly(value())
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--concurrency') options.concurrency = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${USAGE}.`)
  }

  if (options.help) return options
  if (options.apply && options.verify) {
    throw new Error(`--apply e --verify são mutuamente exclusivos — ${USAGE}.`)
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error(`--limit deve ser >= 1 — ${USAGE}.`)
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error(`--concurrency deve ser >= 1 — ${USAGE}.`)
  }
  if (options.out.split(/[\\/]/).includes('..')) {
    throw new Error('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

/**
 * The eligible queue: an APPROVED photo with a stored filename has a public
 * preview to serve, so it deserves a grade. Draft and removed rows stay out
 * (the removal guardrail: generating for them would be discarded work), and a
 * row with no file can never produce one.
 *
 * @param {Array<{ id: number, flickrId: string, filename: string | null | undefined, publicationStatus: string }>} rows
 * @returns {Array<{ id: number, flickrId: string, filename: string }>}
 */
export const archiveThumbnailEligibleRows = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row.publicationStatus === 'approved' && Boolean(row.filename))
    .map((row) => ({ id: row.id, flickrId: row.flickrId, filename: row.filename }))

/**
 * Aggregates one read-only probe (plan/verify): how many eligible photos have
 * the stored grade and how many still miss it. The probe never throws by
 * design (an unreachable store reads as missing), so a completely missing
 * coverage in the receipt is also the honest signal to check the bucket.
 *
 * @param {Array<{ id: number, flickrId: string, present: boolean }>} results
 */
export const summarizeArchiveThumbnailProbe = (results) => {
  let present = 0
  let missing = 0
  const missingIds = []
  for (const result of results) {
    if (result.present) present += 1
    else {
      missing += 1
      missingIds.push(result.id)
    }
  }
  return { eligible: results.length, present, missing, missingIds }
}

/**
 * Aggregates one `--apply` run: what was generated, what was honestly skipped
 * (missing/corrupt origin, already present) and what failed and deserves a
 * retry. `bytes` sums only the fresh encodes.
 *
 * @param {Array<{ id: number, outcome: { status: string, reason?: string, detail?: string, bytes?: number } }>} results
 */
export const summarizeArchiveThumbnailRun = (results) => {
  let generated = 0
  let skipped = 0
  let failed = 0
  let bytes = 0
  const skippedByReason = {}
  for (const result of results) {
    const outcome = result.outcome ?? {}
    if (outcome.status === 'generated') {
      generated += 1
      bytes += Number(outcome.bytes) || 0
    } else if (outcome.status === 'skipped') {
      skipped += 1
      const reason = outcome.reason ?? 'unknown'
      skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1
    } else {
      // Unknown outcomes are failures: a new status must never hide in "skips".
      failed += 1
    }
  }
  return { eligible: results.length, generated, skipped, failed, bytes, skippedByReason }
}

const SKIP_LABEL = {
  'already-present': 'já existia',
  'missing-origin': 'original ausente',
  'corrupt-origin': 'original ilegível',
  'no-filename': 'sem arquivo',
  'recent-failure': 'falha recente',
}

/**
 * Human lines of the plan/verify probe; the JSON keeps the full report.
 *
 * @param {Record<string, any>} report
 * @returns {string[]}
 */
export const formatArchiveThumbnailProbeReport = (report) => {
  const label = '[archive:thumbnails]'
  const probe = report.probe
  return [
    `${label} álbum aprovado: ${probe.eligible} foto(s) · miniatura presente: ${probe.present} · faltando: ${probe.missing}`,
    ...(probe.missing > 0
      ? [
          `${label} ${report.mode === 'plan' ? 'rode `pnpm archive:thumbnails --apply` para gerar as faltantes' : 'cobertura incompleta — rode o --apply'}.`,
        ]
      : []),
  ]
}

/**
 * Human lines of the `--apply` receipt, listing every skip and failure with
 * its reason.
 *
 * @param {Record<string, any>} report
 * @returns {string[]}
 */
export const formatArchiveThumbnailRunReport = (report) => {
  const label = '[archive:thumbnails]'
  const summary = report.summary
  const lines = [
    `${label} lote: ${summary.eligible} foto(s) elegível(is) · geradas: ${summary.generated} · puladas: ${summary.skipped} · falhas: ${summary.failed} (${formatArchiveBytes(summary.bytes)})`,
  ]
  for (const [reason, count] of Object.entries(summary.skippedByReason)) {
    lines.push(`  - ${SKIP_LABEL[reason] ?? reason}: ${count}`)
  }
  for (const item of report.skipped ?? []) {
    lines.push(
      `  - pulada ${item.id} (${item.filename}) [${SKIP_LABEL[item.reason] ?? item.reason}]${item.detail ? `: ${item.detail}` : ''}`,
    )
  }
  for (const item of report.failed ?? []) {
    lines.push(`  - falha ${item.id} (${item.filename}): ${item.reason ?? 'erro'}`)
  }
  return lines
}
