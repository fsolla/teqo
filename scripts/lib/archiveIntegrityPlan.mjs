/**
 * C246 — pure planning/reporting of the photo-archive integrity sweep: the argv
 * parser, the bounded-concurrency map, the scan/repair summaries and the human
 * lines + JSON receipt. No I/O of its own: the inspector, the Flickr client and
 * the Payload writes are injected, so the unit spec drives everything with fakes.
 */

import { formatArchiveBytes } from './flickrPlan.mjs'

const USAGE =
  'uso: `pnpm archive:integrity [--apply] [--only <ids>] [--limit <n>] [--concurrency <n>] [--out <dir>]`'

export const ARCHIVE_INTEGRITY_DEFAULT_OUT_DIR = 'data/archive'
export const ARCHIVE_INTEGRITY_DEFAULT_CONCURRENCY = 3

export const archiveIntegrityReportStamp = (runAt) => String(runAt).replace(/[:.]/g, '-')

/**
 * `--only 80,83` → `[80, 83]` (photo ids, the row primary key). Exact digits
 * only: a typo must refuse the run, never silently widen or empty the selection.
 *
 * @param {string} value
 * @returns {number[]}
 */
export const parseArchiveIntegrityOnly = (value) => {
  const text = String(value ?? '').trim()
  if (text === '')
    throw new Error(`--only vazio — informe ao menos um id (ex.: --only 80,83) — ${USAGE}.`)
  const ids = []
  for (const part of text.split(',')) {
    const item = part.trim()
    if (!/^\d+$/.test(item)) {
      throw new Error(
        `--only espera ids numéricos separados por vírgula (recebi "${value}") — ${USAGE}.`,
      )
    }
    const id = Number(item)
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new Error(`--only recebeu um id fora do intervalo: "${item}" — ${USAGE}.`)
    }
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/**
 * `pnpm archive:integrity` argv parser — pure, so the unit spec pins it (the
 * CLI owns the exit and the help text). The default mode is the read-only
 * sweep; `--apply` adds the repair pass. Errors carry the usage line.
 *
 * @param {string[]} [argv]
 * @returns {{ apply: boolean, only: number[] | null, limit: number | null, concurrency: number, out: string, help: boolean }}
 */
export const parseArchiveIntegrityCliArgs = (argv = process.argv.slice(2)) => {
  const options = {
    apply: false,
    only: null,
    limit: null,
    concurrency: ARCHIVE_INTEGRITY_DEFAULT_CONCURRENCY,
    out: ARCHIVE_INTEGRITY_DEFAULT_OUT_DIR,
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
    else if (arg === '--only') options.only = parseArchiveIntegrityOnly(value())
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--concurrency') options.concurrency = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${USAGE}.`)
  }

  if (options.help) return options
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
 * Bounded-concurrency map that preserves input order. The sweep downloads and
 * decodes 6k+ photos, so unbounded `Promise.all` would be reckless; the pool
 * keeps at most `concurrency` workers alive and returns the results in the
 * same order as the input (receipts stay deterministic).
 *
 * @template T, R
 * @param {readonly T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
export const mapWithConcurrency = async (items, concurrency, worker) => {
  const results = new Array(items.length)
  const size = Math.max(1, Math.min(Math.trunc(Number(concurrency)) || 1, items.length))
  let next = 0

  const runner = async () => {
    for (;;) {
      const index = next
      next += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: size }, runner))
  return results
}

/**
 * Aggregates one sweep: what was read whole, what is missing/corrupt, and the
 * rows kept out of the repair (`removed` is a takedown, C242). `pending` counts
 * ONLY the broken `approved` rows — the public gap the read-only sweep fails on.
 * A broken `draft` (already out of the public, e.g. withdrawn by a previous
 * repair) and a broken `removed` are recorded but never block: the convergence
 * after an `--apply` must be reachable.
 *
 * @param {Array<{ id: number, flickrId: string, filename: string | null, publicationStatus: string, status: 'ok' | 'missing' | 'corrupt', stage?: string | null, reason?: string | null, bytes?: number | null }>} results
 */
export const summarizeArchiveIntegrityScan = (results) => {
  const missing = []
  const corrupted = []
  const draftBroken = []
  const removedBroken = []
  let ok = 0
  let removedScanned = 0
  let pending = 0
  let bytes = 0

  for (const result of results) {
    bytes += Number(result.bytes) || 0
    const publicationStatus = result.publicationStatus
    const removed = publicationStatus === 'removed'
    if (removed) removedScanned += 1

    if (result.status === 'ok') {
      if (!removed) ok += 1
      continue
    }

    const entry = {
      id: result.id,
      flickrId: result.flickrId,
      filename: result.filename ?? null,
      publicationStatus,
      stage: result.stage ?? null,
      reason: result.reason ?? null,
    }
    if (removed) {
      removedBroken.push({ ...entry, status: result.status })
      continue
    }
    if (result.status === 'missing') missing.push(entry)
    else corrupted.push(entry)
    if (publicationStatus === 'approved') pending += 1
    else draftBroken.push({ ...entry, status: result.status })
  }

  return {
    scanned: results.length,
    ok,
    missing,
    corrupted,
    draftBroken,
    removedScanned,
    removedBroken,
    pending,
    bytes,
  }
}

const PUBLICATION_LABEL = { approved: 'aprovada', draft: 'rascunho', removed: 'removida' }

/**
 * Human lines for the sweep; the JSON file keeps the full report. Every broken
 * row is named with id/arquivo/estado e o motivo.
 *
 * @param {Record<string, any>} report
 * @returns {string[]}
 */
export const formatArchiveIntegrityScanReport = (report) => {
  const label = '[archive:integrity]'
  const scan = report.scan
  const describe = (item) =>
    `${item.id} (${item.filename ?? 'sem arquivo'}, ${PUBLICATION_LABEL[item.publicationStatus] ?? item.publicationStatus})`
  const lines = [
    `${label} varredura: ${scan.scanned} foto(s) · íntegras: ${scan.ok} · ausentes: ${scan.missing.length} · corrompidas: ${scan.corrupted.length} · quebradas fora do público: ${scan.draftBroken.length}`,
    `${label} pendência pública (aprovadas quebradas): ${scan.pending}`,
    `${label} removidas (takedown, não reparadas): ${scan.removedScanned} · com objeto quebrado: ${scan.removedBroken.length}`,
    `${label} objeto lido: ${formatArchiveBytes(scan.bytes)} em ${(report.durationMs / 1000).toFixed(1)}s`,
  ]
  for (const item of scan.missing) {
    lines.push(`  - ausente ${describe(item)}`)
  }
  for (const item of scan.corrupted) {
    lines.push(
      `  - corrompida ${describe(item)}${item.stage ? ` [${item.stage}]` : ''}: ${item.reason ?? 'erro'}`,
    )
  }
  for (const item of scan.removedBroken) {
    lines.push(`  - removida quebrada ${describe(item)} [${item.status}]: ${item.reason ?? 'erro'}`)
  }
  return lines
}

/**
 * Aggregates one repair pass over the broken non-removed rows: what came back
 * (`recovered`), what left the public with a record (`unrecoverable`) and what
 * failed and needs another run.
 *
 * @param {Array<{ id: number, flickrId: string, filename: string | null, action: 'recovered' | 'unrecoverable' | 'failed', sourceUrl?: string | null, sha256?: string | null, bytes?: number | null, previousStatus?: string | null, newStatus?: string | null, stage?: string | null, reason?: string | null }>} results
 */
export const summarizeArchiveIntegrityRepair = (results) => {
  const recovered = []
  const unrecoverable = []
  const failed = []

  for (const result of results) {
    if (result.action === 'recovered') recovered.push(result)
    else if (result.action === 'unrecoverable') unrecoverable.push(result)
    else failed.push(result)
  }

  return { recovered, unrecoverable, failed }
}

/**
 * Human lines for the repair pass. Recovered photos carry provenance (source
 * URL, bytes, sha256 prefix); unrecoverable ones carry the record of the exit
 * from the public; failures name their stage.
 *
 * @param {Record<string, any>} report
 * @returns {string[]}
 */
export const formatArchiveIntegrityRepairReport = (report) => {
  const label = '[archive:integrity]'
  const repair = report.repair
  const lines = [
    `${label} reparo: recuperadas: ${repair.recovered.length} · irrecuperáveis (fora do público): ${repair.unrecoverable.length} · falhas: ${repair.failed.length}`,
  ]
  for (const item of repair.recovered) {
    lines.push(
      `  - recuperada ${item.id} (${item.filename ?? 'sem arquivo'}) ${formatArchiveBytes(item.bytes)}` +
        `${item.sha256 ? ` sha256:${String(item.sha256).slice(0, 12)}…` : ''}` +
        `${item.sourceUrl ? ` ← ${item.sourceUrl}` : ''}`,
    )
  }
  for (const item of repair.unrecoverable) {
    lines.push(
      `  - irrecuperável ${item.id} (${item.filename ?? 'sem arquivo'})` +
        `${item.previousStatus ? ` ${item.previousStatus} → ${item.newStatus ?? 'draft'}` : ''}: ${item.reason ?? 'fonte indisponível'}`,
    )
  }
  for (const item of repair.failed) {
    lines.push(
      `  - falha ${item.id} (${item.filename ?? 'sem arquivo'})${item.stage ? ` [${item.stage}]` : ''}: ${item.reason ?? 'erro'}`,
    )
  }
  return lines
}
