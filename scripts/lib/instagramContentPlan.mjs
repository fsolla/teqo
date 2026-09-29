/**
 * C230-followup — pure planning/reporting of the Instagram content import CLI
 * (`import-instagram-content.mjs`): filter the official feed to the declared
 * recency window, classify each post into an import candidate, dedupe by the
 * post identity (what the Central already carries, in any URL spelling) and
 * aggregate the honest run report. No I/O and no `server-only`: the unit specs
 * read this module and the CLI is the impure shell.
 */

import {
  contentPiecePostIdentityUrls,
  contentPieceProfileCandidateFromPost,
  parseContentPieceLink,
} from '../../src/lib/contentPiece.ts'

/** Default recency window of one import run (the request's 60 days). */
const INSTAGRAM_CONTENT_DEFAULT_DAYS = 60

/** Defensive ceiling: a window longer than a year is a typo, not an intent. */
const INSTAGRAM_CONTENT_MAX_DAYS = 365

const INSTAGRAM_CONTENT_DEFAULT_OUT_DIR = 'data/content-instagram'

const INSTAGRAM_CONTENT_USAGE =
  'pnpm content:instagram:import [--apply] [--publish] [--days 60] [--limit n] [--out data/content-instagram]'

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
    else if (arg === '--days') options.days = Number(value())
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${INSTAGRAM_CONTENT_USAGE}.`)
  }

  if (options.help) return options
  if (options.publish && !options.apply) {
    throw new Error(`--publish exige --apply — ${INSTAGRAM_CONTENT_USAGE}.`)
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
 * The identity URLs of every parseable post of the feed — what the dedupe
 * query asks the Central for in ONE `sourceUrl in` lookup. A permalink the
 * catalogue cannot parse contributes nothing (it never becomes a candidate).
 *
 * @param {Array<{ permalink: string, mediaType: string, mediaUrl?: string | null }>} posts
 * @returns {string[]}
 */
export const instagramContentFeedIdentityUrls = (posts) => {
  const urls = new Set()
  for (const post of posts) {
    const candidate = contentPieceProfileCandidateFromPost(post)
    if (!candidate) continue
    const link = parseContentPieceLink(candidate.url)
    if (!link) continue
    for (const url of contentPiecePostIdentityUrls(link)) urls.add(url)
  }
  return [...urls]
}

/**
 * Filters the feed to the recency window and splits it into novelties, pieces
 * the Central already had and posts that cannot be imported (outside the
 * window, unparseable permalink or a repeated identity inside the feed).
 * Candidates keep the feed order (newest first).
 *
 * `found` counts the parseable posts inside the window: candidates + already
 * catalogued + repeated identities.
 *
 * @param {{
 *   posts: Array<{ permalink: string, mediaType: string, mediaUrl?: string | null, timestamp: string }>,
 *   existingSourceUrls?: string[],
 *   from: string,
 *   to: string,
 * }} input
 */
export const planInstagramContentWindow = ({ posts, existingSourceUrls = [], from, to }) => {
  const fromMs = Date.parse(from)
  const toMs = Date.parse(to)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    throw new Error('janela inválida: from/to precisam ser instantes ISO.')
  }

  const existing = new Set(existingSourceUrls)
  const seen = new Set()
  const candidates = []
  const existingShortcodes = []
  let outsideWindow = 0
  let malformed = 0
  let feedDuplicates = 0

  for (const post of posts) {
    const timestamp = Date.parse(post.timestamp)
    if (!Number.isFinite(timestamp) || timestamp < fromMs || timestamp > toMs) {
      // An item without a usable timestamp cannot be placed in the window.
      if (!Number.isFinite(timestamp)) malformed += 1
      else outsideWindow += 1
      continue
    }

    const candidate = contentPieceProfileCandidateFromPost(post)
    const link = candidate ? parseContentPieceLink(candidate.url) : null
    if (!candidate || !link) {
      malformed += 1
      continue
    }

    const identityUrls = contentPiecePostIdentityUrls(link)
    if (identityUrls.some((url) => existing.has(url))) {
      existingShortcodes.push(link.shortcode)
      continue
    }
    if (identityUrls.some((url) => seen.has(url))) {
      feedDuplicates += 1
      continue
    }
    identityUrls.forEach((url) => seen.add(url))
    candidates.push({
      url: candidate.url,
      shortcode: link.shortcode,
      linkOnlyReason: candidate.linkOnlyReason,
      timestamp: post.timestamp,
      mediaType: post.mediaType,
    })
  }

  return {
    window: { from, to },
    found: candidates.length + existingShortcodes.length + feedDuplicates,
    existingCount: existingShortcodes.length,
    existingShortcodes,
    feedDuplicates,
    malformed,
    outsideWindow,
    candidates,
  }
}

/**
 * The publish rule of the import: only a piece the pipeline finished (`pronto`)
 * goes public, and only when the run asked for it. A `falhou` piece stays a
 * draft and the receipt names it.
 */
export const shouldPublishImportedPiece = ({ processingStatus, publish }) =>
  publish === true && processingStatus === 'pronto'

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
