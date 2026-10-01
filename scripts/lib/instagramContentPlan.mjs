/**
 * C230-followup — pure planning/reporting of the Instagram content ops CLIs
 * (`import-instagram-content.mjs` and `withdraw-instagram-content.mjs`):
 * filter the official feed to the declared recency window, classify each post
 * into an import candidate, dedupe by the post identity (what the Central
 * already carries, in any URL spelling), order the window's ready drafts for
 * publication, split the published set by a civil cutoff and aggregate the
 * honest run reports. No I/O and no `server-only`: the unit specs read this
 * module and the CLIs are the impure shells.
 */

import { parseContentPieceLink } from '../../src/lib/contentPiece.ts'
import {
  contentPieceProfileFeedIdentityUrls,
  contentPieceProfilePeriodBounds,
  planContentPieceProfileWindow,
} from '../../src/lib/contentPieceProfileWindow.ts'

// C235 — the window filter and the identity dedupe moved to their single owner
// in `src/lib` (the server importer reads the same policy); the names below are
// the CLI contract this module has always exported.
export const planInstagramContentWindow = planContentPieceProfileWindow
export const instagramContentFeedIdentityUrls = contentPieceProfileFeedIdentityUrls

/** Default recency window of one import run (the request's 60 days). */
const INSTAGRAM_CONTENT_DEFAULT_DAYS = 60

/** Defensive ceiling: a window longer than a year is a typo, not an intent. */
const INSTAGRAM_CONTENT_MAX_DAYS = 365

const INSTAGRAM_CONTENT_DEFAULT_OUT_DIR = 'data/content-instagram'

const INSTAGRAM_CONTENT_USAGE =
  'pnpm content:instagram:import [--apply] [--publish] [--publish-existing] [--days 60] [--limit n] [--out data/content-instagram]'

const INSTAGRAM_CONTENT_WITHDRAW_USAGE =
  'pnpm content:instagram:withdraw --before YYYY-MM-DD [--scan-days 90] [--apply] [--out data/content-instagram]'

const INSTAGRAM_CONTENT_PRUNE_USAGE =
  'pnpm content:instagram:prune --before YYYY-MM-DD [--scan-days 365] [--apply] [--out data/content-instagram]'

/** Report file stamp: the run's ISO instant with `:`/`.` swapped, like C215. */
export const instagramContentReportStamp = (runAt) => runAt.replace(/[:.]/g, '-')

/**
 * Parses the CLI arguments. `--publish` only exists with `--apply` (there is
 * nothing to publish in the plan mode) and `--out` cannot escape the repo.
 *
 * @param {string[]} [argv]
 */
export const parseInstagramContentCliArgs = (argv = process.argv.slice(2)) => {
  const options = {
    apply: false,
    publish: false,
    publishExisting: false,
    days: INSTAGRAM_CONTENT_DEFAULT_DAYS,
    limit: null,
    out: INSTAGRAM_CONTENT_DEFAULT_OUT_DIR,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => {
      const next = argv[++index]
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`faltou valor para ${arg} — ${INSTAGRAM_CONTENT_USAGE}.`)
      }
      return next
    }
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--apply') options.apply = true
    else if (arg === '--publish') options.publish = true
    else if (arg === '--publish-existing') options.publishExisting = true
    else if (arg === '--days') options.days = Number(value())
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${INSTAGRAM_CONTENT_USAGE}.`)
  }

  if (options.help) return options
  if (options.publish && !options.apply) {
    throw new Error(`--publish exige --apply — ${INSTAGRAM_CONTENT_USAGE}.`)
  }
  if (options.publishExisting && !options.apply) {
    throw new Error(`--publish-existing exige --apply — ${INSTAGRAM_CONTENT_USAGE}.`)
  }
  if (
    !Number.isInteger(options.days) ||
    options.days < 1 ||
    options.days > INSTAGRAM_CONTENT_MAX_DAYS
  ) {
    throw new Error(`--days deve ser um inteiro entre 1 e ${INSTAGRAM_CONTENT_MAX_DAYS}.`)
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit deve ser >= 1.')
  }
  if (options.out.split(/[\\/]/).includes('..')) {
    throw new Error('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

/**
 * Parses the withdraw CLI arguments. `--before` is a REQUIRED Bahia civil date
 * (the campaign cutoff is a legal boundary, never a hidden default) and the
 * `--scan-days` walk depth only bounds how far back the feed is read to date
 * the published pieces.
 *
 * @param {string[]} [argv]
 */
export const parseInstagramContentWithdrawCliArgs = (argv = process.argv.slice(2)) => {
  const options = {
    apply: false,
    before: null,
    scanDays: 90,
    out: INSTAGRAM_CONTENT_DEFAULT_OUT_DIR,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => {
      const next = argv[++index]
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`faltou valor para ${arg} — ${INSTAGRAM_CONTENT_WITHDRAW_USAGE}.`)
      }
      return next
    }
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--apply') options.apply = true
    else if (arg === '--before') options.before = value()
    else if (arg === '--scan-days') options.scanDays = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${INSTAGRAM_CONTENT_WITHDRAW_USAGE}.`)
  }

  if (options.help) return options
  if (options.before === null) {
    throw new Error(`--before é obrigatório — ${INSTAGRAM_CONTENT_WITHDRAW_USAGE}.`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(options.before))) {
    throw new Error('--before deve ser uma data civil YYYY-MM-DD.')
  }
  try {
    contentPieceProfilePeriodBounds({ since: options.before })
  } catch {
    throw new Error('--before deve ser uma data civil válida.')
  }
  if (!Number.isInteger(options.scanDays) || options.scanDays < 1 || options.scanDays > 365) {
    throw new Error('--scan-days deve ser um inteiro entre 1 e 365.')
  }
  if (options.out.split(/[\\/]/).includes('..')) {
    throw new Error('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

/**
 * Parses the prune CLI arguments. `--before` is a REQUIRED Bahia civil date
 * (the campaign cutoff is a legal boundary, never a hidden default) and the
 * `--scan-days` walk depth only bounds how far back the feed is read to date
 * the catalogue rows; the default is deeper than the withdraw's because a prune
 * targets the oldest rows of the catalogue (the whole electoral era fits in a
 * year).
 *
 * @param {string[]} [argv]
 */
export const parseInstagramContentPruneCliArgs = (argv = process.argv.slice(2)) => {
  const options = {
    apply: false,
    before: null,
    scanDays: 365,
    out: INSTAGRAM_CONTENT_DEFAULT_OUT_DIR,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => {
      const next = argv[++index]
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`faltou valor para ${arg} — ${INSTAGRAM_CONTENT_PRUNE_USAGE}.`)
      }
      return next
    }
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--apply') options.apply = true
    else if (arg === '--before') options.before = value()
    else if (arg === '--scan-days') options.scanDays = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${INSTAGRAM_CONTENT_PRUNE_USAGE}.`)
  }

  if (options.help) return options
  if (options.before === null) {
    throw new Error(`--before é obrigatório — ${INSTAGRAM_CONTENT_PRUNE_USAGE}.`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(options.before))) {
    throw new Error('--before deve ser uma data civil YYYY-MM-DD.')
  }
  try {
    contentPieceProfilePeriodBounds({ since: options.before })
  } catch {
    throw new Error('--before deve ser uma data civil válida.')
  }
  if (!Number.isInteger(options.scanDays) || options.scanDays < 1 || options.scanDays > 365) {
    throw new Error('--scan-days deve ser um inteiro entre 1 e 365.')
  }
  if (options.out.split(/[\\/]/).includes('..')) {
    throw new Error('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

/**
 * The publish rule of the import: only a piece the pipeline finished (`pronto`)
 * goes public, and only when the run asked for it. A `falhou` piece stays a
 * draft and the receipt names it.
 */
export const shouldPublishImportedPiece = ({ processingStatus, publish }) =>
  publish === true && processingStatus === 'pronto'

/**
 * shortcode → earliest post instant (ms) of the official feed. A link the
 * catalogue cannot parse contributes nothing; a repeated post keeps the
 * earliest instant (the original publication).
 *
 * @param {readonly { permalink: string, mediaType: string, mediaUrl?: string | null, timestamp: string }[]} posts
 * @returns {Map<string, number>}
 */
export const instagramContentPostDates = (posts) => {
  const dates = new Map()
  for (const post of posts) {
    const link = parseContentPieceLink(post.permalink)
    const timestamp = Date.parse(post.timestamp)
    if (!link || link.origin !== 'instagram' || !Number.isFinite(timestamp)) continue
    const current = dates.get(link.shortcode)
    if (current === undefined || timestamp < current) dates.set(link.shortcode, timestamp)
  }
  return dates
}

/**
 * Orders the window's ready drafts for publication: oldest post first, so the
 * newest post carries the latest `publishedAt` (the public listing sorts by
 * `-publishedAt`). A piece whose post is not in the feed is named, never
 * dropped silently.
 *
 * @param {{
 *   pieces: Array<{ id: number, title?: string | null, sourceUrl?: string | null, linkFailureReason?: string | null }>,
 *   posts: Parameters<typeof instagramContentPostDates>[0],
 * }} input
 */
export const planInstagramContentDraftsToPublish = ({ pieces, posts }) => {
  const dates = instagramContentPostDates(posts)
  const ordered = []
  const undateable = []

  for (const piece of pieces) {
    const link = parseContentPieceLink(piece.sourceUrl)
    const timestamp = link?.origin === 'instagram' ? dates.get(link.shortcode) : undefined
    if (timestamp === undefined) {
      undateable.push(piece)
      continue
    }
    ordered.push({ ...piece, shortcode: link.shortcode, postTimestamp: timestamp })
  }
  ordered.sort((left, right) => left.postTimestamp - right.postTimestamp)

  return {
    ordered,
    undateable,
    linkOnly: ordered.filter(
      (piece) => typeof piece.linkFailureReason === 'string' && piece.linkFailureReason !== '',
    ).length,
  }
}

/**
 * The one cutoff split shared by the withdraw and prune plans: a post strictly
 * BEFORE the `before` civil day (Bahia time, the electoral calendar's timezone)
 * matches; the boundary instant comes from the domain owner of the civil dates,
 * never a re-spelled offset. A piece whose post is not in the feed is named and
 * left untouched (fail-closed on an unknown date).
 *
 * @param {{
 *   pieces: Array<{ id: number, title?: string | null, sourceUrl?: string | null }>,
 *   posts: Parameters<typeof instagramContentPostDates>[0],
 *   before: string,
 * }} input
 */
const planContentPiecesBeforeCutoff = ({ pieces, posts, before }) => {
  const { fromIso } = contentPieceProfilePeriodBounds({ since: before })
  const cutoffMs = Date.parse(fromIso)
  const dates = instagramContentPostDates(posts)
  const matched = []
  const undateable = []

  for (const piece of pieces) {
    const link = parseContentPieceLink(piece.sourceUrl)
    const timestamp = link?.origin === 'instagram' ? dates.get(link.shortcode) : undefined
    if (timestamp === undefined) {
      undateable.push(piece)
      continue
    }
    if (timestamp < cutoffMs) {
      matched.push({
        ...piece,
        shortcode: link.shortcode,
        postTimestamp: timestamp,
        postDate: new Date(timestamp).toISOString(),
      })
    }
  }
  matched.sort((left, right) => left.postTimestamp - right.postTimestamp)

  return { cutoffIso: fromIso, matched, undateable }
}

/**
 * Splits the published set by the civil cutoff (the withdraw plan): posts before
 * the day leave the public listing.
 *
 * @param {Parameters<typeof planContentPiecesBeforeCutoff>[0]} input
 */
export const planInstagramContentWithdraw = (input) => {
  const { cutoffIso, matched, undateable } = planContentPiecesBeforeCutoff(input)
  return { cutoffIso, toWithdraw: matched, undateable }
}

/**
 * Splits the catalogue set by the civil cutoff (the prune plan): every piece
 * before the day — draft or published — is matched for deletion. Same dating
 * authority and same fail-closed on undateable rows as the withdraw plan.
 *
 * @param {Parameters<typeof planContentPiecesBeforeCutoff>[0]} input
 */
export const planInstagramContentPrune = (input) => {
  const { cutoffIso, matched, undateable } = planContentPiecesBeforeCutoff(input)
  return { cutoffIso, toDelete: matched, undateable }
}

/**
 * Aggregates the per-candidate results of an `--apply` run. `asrCostUsd` uses
 * the provider's per-audio-minute price passed by the shell (the app-side
 * owner of the constant), never a guessed duration.
 *
 * @param {Array<{ outcome: string, processingStatus?: string | null, linkFailureReason?: string | null, published?: boolean, durationSeconds?: number | null, error?: string | null }>} results
 * @param {{ costPerMinuteUsd?: number }} [options]
 */
export const summarizeInstagramContentResults = (results, { costPerMinuteUsd = 0 } = {}) => {
  const count = (predicate) => results.filter(predicate).length
  const asrSeconds = results.reduce(
    (total, result) => total + (Number(result.durationSeconds) || 0),
    0,
  )

  return {
    attempted: results.length,
    created: count((result) => result.outcome === 'created'),
    existing: count((result) => result.outcome === 'existing'),
    ready: count((result) => result.processingStatus === 'pronto'),
    failed: count((result) => result.processingStatus === 'falhou'),
    published: count((result) => result.published === true),
    linkOnly: count(
      (result) => typeof result.linkFailureReason === 'string' && result.linkFailureReason !== '',
    ),
    asrSeconds: Math.round(asrSeconds),
    asrCostUsd: Number(((asrSeconds / 60) * costPerMinuteUsd).toFixed(4)),
  }
}

/**
 * The receipt lines the operator reads (and the JSON mirrors). Only facts the
 * run actually observed: a failure is named with its shortcode and reason.
 *
 * @param {{
 *   target: string,
 *   mode: 'plan' | 'apply',
 *   window: { days: number, from: string, to: string },
 *   feedCount: number,
 *   plan: ReturnType<typeof planInstagramContentWindow>,
 *   summary?: ReturnType<typeof summarizeInstagramContentResults>,
 *   publishedExisting?: number,
 *   failures?: Array<{ shortcode: string, error: string }>,
 *   candidatesRemaining?: number,
 *   reportPath?: string | null,
 * }} report
 */
export const formatInstagramContentReport = (report) => {
  const lines = []
  const plannedLinkOnly = report.plan.candidates.filter(
    (candidate) => candidate.linkOnlyReason !== null,
  ).length

  lines.push(`[content:instagram:import] alvo: ${report.target} | modo: ${report.mode}`)
  lines.push(`janela: ${report.window.days} dias (${report.window.from} → ${report.window.to})`)
  lines.push(
    `feed: ${report.feedCount} mídias · na janela: ${report.plan.found} · já na Central: ${report.plan.existingCount} · fora da janela: ${report.plan.outsideWindow} · sem identidade: ${report.plan.malformed}`,
  )
  lines.push(
    `candidatos: ${report.plan.candidates.length} (peça-link previstos: ${plannedLinkOnly})`,
  )

  if (report.summary) {
    lines.push(
      `novas: ${report.summary.created} · já estavam: ${report.summary.existing} · prontas: ${report.summary.ready} · falharam: ${report.summary.failed} · publicadas: ${report.summary.published} · peça-link: ${report.summary.linkOnly}`,
    )
    lines.push(`ASR: ${report.summary.asrSeconds}s (~US$ ${report.summary.asrCostUsd})`)
    if ((report.publishedExisting ?? 0) > 0) {
      lines.push(
        `publicadas da janela (já importadas, rascunhos prontos): ${report.publishedExisting}`,
      )
    }
    for (const failure of report.failures ?? []) {
      lines.push(`  - falha ${failure.shortcode}: ${failure.error}`)
    }
    for (const candidate of report.plan.candidates.filter(
      (entry) => entry.linkOnlyReason !== null,
    )) {
      lines.push(`  - peça-link ${candidate.shortcode}: ${candidate.linkOnlyReason}`)
    }
  }

  if ((report.candidatesRemaining ?? 0) > 0) {
    lines.push(
      `restam ${report.candidatesRemaining} candidatos no lote — rode de novo para terminar.`,
    )
  }
  if (report.reportPath) lines.push(`recibo: ${report.reportPath}`)
  return lines
}

const CUTOFF_SAMPLE_LIMIT = 10

/**
 * The withdraw receipt lines the operator reads (and the JSON mirrors): the
 * cutoff, what the feed could date, the withdrawn set with its period and the
 * pieces the feed could not date (never touched, always named).
 *
 * @param {{
 *   target: string,
 *   mode: 'plan' | 'apply',
 *   before: string,
 *   scanDays: number,
 *   feedCount: number,
 *   publishedCount: number,
 *   plan: ReturnType<typeof planInstagramContentWithdraw>,
 *   withdrawn?: number,
 *   failures?: Array<{ id: number, reason: string }>,
 *   revalidation?: { attempted: boolean, ok: boolean, reason: string | null },
 *   reportPath?: string | null,
 * }} report
 */
export const formatInstagramContentWithdrawReport = (report) => {
  const lines = []
  const { toWithdraw, undateable } = report.plan
  const dates = toWithdraw.map((entry) => entry.postTimestamp)

  lines.push(`[content:instagram:withdraw] alvo: ${report.target} | modo: ${report.mode}`)
  lines.push(
    `corte: ${report.before} (Bahia; posts anteriores) · varredura: ${report.scanDays} dias · feed: ${report.feedCount} mídias`,
  )
  lines.push(
    `publicadas: ${report.publishedCount} · anteriores ao corte: ${toWithdraw.length} · sem data no feed: ${undateable.length}`,
  )
  if (toWithdraw.length > 0) {
    lines.push(
      `período das retiradas: ${new Date(Math.min(...dates)).toISOString()} → ${new Date(Math.max(...dates)).toISOString()}`,
    )
    for (const entry of toWithdraw.slice(0, CUTOFF_SAMPLE_LIMIT)) {
      lines.push(
        `  - ${entry.shortcode} (${entry.postDate.slice(0, 10)}) ${entry.title ?? ''}`.trim(),
      )
    }
    if (toWithdraw.length > CUTOFF_SAMPLE_LIMIT) {
      lines.push(`  … +${toWithdraw.length - CUTOFF_SAMPLE_LIMIT}`)
    }
  }
  for (const entry of undateable) {
    lines.push(
      `  ? sem data: #${entry.id} ${entry.title ?? ''} — ${entry.sourceUrl ?? 'sem URL'}`.trim(),
    )
  }
  if (report.mode === 'apply') {
    lines.push(
      `retiradas: ${report.withdrawn ?? 0} · falhas: ${report.failures?.length ?? 0} · revalidação: ${
        report.revalidation?.ok ? 'ok' : (report.revalidation?.reason ?? 'não tentada')
      }`,
    )
    for (const failure of report.failures ?? []) {
      lines.push(`  - falha #${failure.id}: ${failure.reason}`)
    }
  }
  if (report.reportPath) lines.push(`recibo: ${report.reportPath}`)
  return lines
}

/**
 * The prune receipt lines the operator reads (and the JSON mirrors): the
 * cutoff, what the feed could date, the set matched for deletion with its
 * period and the pieces the feed could not date (never touched, always named).
 * The apply line names the hard delete — the row and its private media leave
 * the catalogue, unlike the withdraw's reversible kill switch.
 *
 * @param {{
 *   target: string,
 *   mode: 'plan' | 'apply',
 *   before: string,
 *   scanDays: number,
 *   feedCount: number,
 *   piecesCount: number,
 *   plan: ReturnType<typeof planInstagramContentPrune>,
 *   deleted?: number,
 *   failures?: Array<{ id: number, reason: string }>,
 *   revalidation?: { attempted: boolean, ok: boolean, reason: string | null },
 *   reportPath?: string | null,
 * }} report
 */
export const formatInstagramContentPruneReport = (report) => {
  const lines = []
  const { toDelete, undateable } = report.plan
  const dates = toDelete.map((entry) => entry.postTimestamp)

  lines.push(`[content:instagram:prune] alvo: ${report.target} | modo: ${report.mode}`)
  lines.push(
    `corte: ${report.before} (Bahia; posts anteriores) · varredura: ${report.scanDays} dias · feed: ${report.feedCount} mídias`,
  )
  lines.push(
    `no catálogo: ${report.piecesCount} · anteriores ao corte: ${toDelete.length} · sem data no feed: ${undateable.length}`,
  )
  if (toDelete.length > 0) {
    lines.push(
      `período das peças: ${new Date(Math.min(...dates)).toISOString()} → ${new Date(Math.max(...dates)).toISOString()}`,
    )
    for (const entry of toDelete.slice(0, CUTOFF_SAMPLE_LIMIT)) {
      lines.push(
        `  - #${entry.id} ${entry.shortcode} (${entry.postDate.slice(0, 10)}) ${entry.title ?? ''}`.trim(),
      )
    }
    if (toDelete.length > CUTOFF_SAMPLE_LIMIT) {
      lines.push(`  … +${toDelete.length - CUTOFF_SAMPLE_LIMIT}`)
    }
  }
  for (const entry of undateable) {
    lines.push(
      `  ? sem data: #${entry.id} ${entry.title ?? ''} — ${entry.sourceUrl ?? 'sem URL'}`.trim(),
    )
  }
  if (report.mode === 'apply') {
    lines.push(
      `apagadas: ${report.deleted ?? 0} · falhas: ${report.failures?.length ?? 0} · revalidação: ${
        report.revalidation?.ok ? 'ok' : (report.revalidation?.reason ?? 'não tentada')
      }`,
    )
    for (const failure of report.failures ?? []) {
      lines.push(`  - falha #${failure.id}: ${failure.reason}`)
    }
  }
  if (report.reportPath) lines.push(`recibo: ${report.reportPath}`)
  return lines
}
