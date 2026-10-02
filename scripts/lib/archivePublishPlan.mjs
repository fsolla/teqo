/**
 * C242 — pure planning/reporting of `pnpm archive:publish`: the argv parser,
 * the run summary and the human lines + JSON receipt. No I/O of its own, so the
 * unit spec drives it with fakes. C249 — the summary/receipt also carry the
 * integrity preflight verdicts (`skippedBroken`).
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
 * C249 — the preflight verdict never counts as an update failure: a draft whose
 * object is missing/corrupt is `skippedBroken` (stage + reason), kept in its own
 * list so the receipt names it without pretending an approval was attempted.
 * `eligible` is the plan-mode census (inspected clean, no write) and is
 * deliberately not a failure — plan and apply receive the same results, so the
 * summary composes for both modes.
 *
 * @param {Array<{ photoId: number, status: string, stage?: string | null, reason?: string | null, error?: string | null }>} results
 */
export const summarizeArchivePublishResults = (results) => {
  const failures = []
  const skippedBroken = []
  let approved = 0
  let failed = 0

  for (const result of results) {
    if (result.status === 'approved') {
      approved += 1
    } else if (result.status === 'skippedBroken') {
      skippedBroken.push({
        photoId: result.photoId,
        stage: result.stage ?? null,
        reason: result.reason ?? null,
      })
    } else if (result.status === 'eligible') {
      continue
    } else {
      failed += 1
      failures.push({ photoId: result.photoId, error: result.error ?? null })
    }
  }

  return {
    approved,
    failed,
    failures,
    skippedBroken,
    skippedBrokenCount: skippedBroken.length,
  }
}

export const formatArchivePublishReport = (report) => {
  const lines = [
    `[archive:publish] modo: ${report.mode} | alvo: ${report.target}`,
    `[archive:publish] fila: ${report.queue.items} de ${report.queue.totalDrafts} draft(s)`,
  ]

  if (report.mode === 'plan') {
    lines.push(
      `[archive:publish] drafts quebrados (fora do lote): ${report.summary?.skippedBrokenCount ?? 0}`,
    )
  } else {
    lines.push(
      `[archive:publish] aprovadas: ${report.summary?.approved ?? 0} | falharam: ${report.summary?.failed ?? 0} | puladas (quebradas): ${report.summary?.skippedBrokenCount ?? 0}`,
    )
  }

  for (const skipped of report.summary?.skippedBroken ?? []) {
    lines.push(
      `[archive:publish]   ! foto ${skipped.photoId} fora do lote (${skipped.stage ?? 'missing'}): ${skipped.reason ?? 'objeto ausente'}`,
    )
  }

  for (const failure of report.summary?.failures ?? []) {
    lines.push(`[archive:publish]   ✗ foto ${failure.photoId}: ${failure.error}`)
  }

  return lines
}
