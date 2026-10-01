/**
 * C242 — pure planning/reporting of `pnpm archive:publish`: the argv parser,
 * the run summary and the human lines + JSON receipt. No I/O of its own, so the
 * unit spec drives it with fakes.
 */

const USAGE = 'uso: `pnpm archive:publish [--apply] [--limit <n>] [--out <dir>]`'

export const ARCHIVE_PUBLISH_DEFAULT_OUT_DIR = 'data/archive'

export const archivePublishReportStamp = (runAt) => String(runAt).replace(/[:.]/g, '-')

/**
 * @param {string[]} [argv]
 * @returns {{ apply: boolean, limit: number | null, out: string, help: boolean }}
 */
export const parseArchivePublishCliArgs = (argv = process.argv.slice(2)) => {
  const options = { apply: false, limit: null, out: ARCHIVE_PUBLISH_DEFAULT_OUT_DIR, help: false }

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
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${USAGE}.`)
  }

  if (options.help) return options
  if (options.limit !== null && (!Number.isSafeInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit deve ser >= 1.')
  }
  if (options.out.split(/[\\/]/).includes('..')) {
    throw new Error('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

/**
 * @param {Array<{ photoId: number, status: string, error?: string | null }>} results
 */
export const summarizeArchivePublishResults = (results) => {
  const failures = []
  let approved = 0
  let failed = 0

  for (const result of results) {
    if (result.status === 'approved') approved += 1
    else {
      failed += 1
      failures.push({ photoId: result.photoId, error: result.error ?? null })
    }
  }

  return { approved, failed, failures }
}

export const formatArchivePublishReport = (report) => {
  const lines = [
    `[archive:publish] modo: ${report.mode} | alvo: ${report.target}`,
    `[archive:publish] drafts elegíveis: ${report.queue.totalDrafts}`,
  ]

  if (report.mode !== 'plan') {
    lines.push(
      `[archive:publish] aprovadas: ${report.summary.approved} | falharam: ${report.summary.failed}`,
    )
  }

  for (const failure of report.summary?.failures ?? []) {
    lines.push(`[archive:publish]   ✗ foto ${failure.photoId}: ${failure.error}`)
  }

  return lines
}
