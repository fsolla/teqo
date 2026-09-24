/**
 * C215 — pure planning/reporting of the web-speech ingestion CLI: validate the
 * batch (one invalid finding fails only itself), dedupe by natural key, decide
 * the planned action per entry and aggregate the run report. No I/O: the unit
 * specs read this module and `import-web-speeches.mjs` is the impure shell.
 */

import { formatSpeechSpan } from '../../src/lib/speechClock.ts'
import {
  isCompleteWebSpeechState,
  parseWebSpeechFinding,
  webSpeechSourceKey,
} from '../../src/lib/webSpeech.ts'

/** @typedef {import('../../src/lib/webSpeech.ts').WebSpeechFinding} WebSpeechFinding */
/** @typedef {import('../../src/utilities/speech/webSpeechIngest.ts').WebSpeechIngestResult} WebSpeechIngestResult */

export { isCompleteWebSpeechState }

/**
 * @param {unknown[]} findings
 * @returns {{ entries: Array<{ index: number, sourceKey: string, finding: WebSpeechFinding }>, invalid: Array<{ index: number, error: string }>, duplicates: Array<{ index: number, sourceKey: string }> }}
 */
export const planWebSpeechBatch = (findings) => {
  const entries = []
  const invalid = []
  const duplicates = []
  const seen = new Set()

  findings.forEach((raw, index) => {
    const parsed = parseWebSpeechFinding(raw)
    if (!parsed.ok) {
      invalid.push({ index, error: parsed.error })
      return
    }
    const sourceKey = webSpeechSourceKey(parsed.finding)
    if (seen.has(sourceKey)) {
      duplicates.push({ index, sourceKey })
      return
    }
    seen.add(sourceKey)
    entries.push({ index, sourceKey, finding: parsed.finding })
  })

  return { entries, invalid, duplicates }
}

/** What a re-run would do to an entry, from its stored state. */
export const webSpeechPlannedAction = (state, reprocess = false) => {
  if (state === null) return 'novo'
  if (!isCompleteWebSpeechState(state)) return 'atualizado'
  return reprocess ? 'reprocessado' : 'ignorado'
}

/** @param {WebSpeechIngestResult[]} results */
export const summarizeWebSpeechResults = (results) => {
  const count = (status) => results.filter((result) => result.status === status).length
  const sum = (pick) => results.reduce((total, result) => total + (Number(pick(result)) || 0), 0)

  return {
    created: count('created'),
    updated: count('updated'),
    skipped: count('skipped'),
    failed: count('failed'),
    asrSeconds: sum((result) => result.asrSeconds),
    asrCostUsd: sum((result) => result.asrCostUsd),
    llmCostUsd: sum((result) => result.llmCostUsd),
    failures: results
      .filter((result) => result.status === 'failed')
      .map((result) => ({
        sourceKey: result.sourceKey,
        stage: result.stage ?? null,
        error: result.error ?? null,
      })),
  }
}

/** @param {Array<{ action: string }>} planned */
export const summarizePlannedActions = (planned) => ({
  novo: planned.filter((entry) => entry.action === 'novo').length,
  atualizado: planned.filter((entry) => entry.action === 'atualizado').length,
  ignorado: planned.filter((entry) => entry.action === 'ignorado').length,
  reprocessado: planned.filter((entry) => entry.action === 'reprocessado').length,
})

const secondsLabel = (seconds) => formatSpeechSpan(Math.round(seconds))

/**
 * Human lines for stdout; the JSON file keeps the full report. Failures are
 * never hidden — each one names its stage and reason.
 *
 * @param {ReturnType<typeof summarizeWebSpeechResults> & { runAt: string, mode: string, findings: number, planned: number, invalid: Array<{index: number, error: string}>, duplicates: Array<{index: number, sourceKey: string}>, durationMs: number, plannedActions?: Record<string, number>|null }} report
 * @returns {string[]}
 */
export const formatWebSpeechReport = (report) => {
  const label = '[falas-web:import]'
  const lines = []
  lines.push(
    `${label} achados: ${report.findings} · considerados: ${report.planned} · inválidos: ${report.invalid.length} · duplicados: ${report.duplicates.length}`,
  )

  if (report.plannedActions) {
    const actions = report.plannedActions
    lines.push(
      `${label} plano (dry-run): novos: ${actions.novo} · atualizados: ${actions.atualizado} · ignorados: ${actions.ignorado} · reprocessados: ${actions.reprocessado}`,
    )
  } else {
    const summary = report
    lines.push(
      `${label} novos: ${summary.created} · atualizados: ${summary.updated} · ignorados: ${summary.skipped} · falhas: ${summary.failed}`,
    )
    lines.push(
      `${label} tempo: ${(report.durationMs / 1000).toFixed(1)}s · ASR: ${secondsLabel(summary.asrSeconds)} (~US$ ${summary.asrCostUsd.toFixed(4)}) · LLM: US$ ${summary.llmCostUsd.toFixed(4)}`,
    )
  }

  for (const failure of report.invalid) {
    lines.push(`${label} inválido #${failure.index}: ${failure.error}`)
  }
  if (report.failures?.length) {
    lines.push(`${label} falhas:`)
    for (const failure of report.failures) {
      lines.push(
        `  - ${failure.sourceKey} (${failure.stage ?? 'desconhecido'}): ${failure.error ?? 'erro'}`,
      )
    }
  }
  return lines
}

export const webSpeechReportStamp = (runAt) => runAt.replace(/[:.]/g, '-')
