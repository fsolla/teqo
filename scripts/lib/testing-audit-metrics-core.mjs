/**
 * Pure core for testing-audit metrics (OPS96) — normalization of native
 * runner reports into the audit's per-layer portrait. No I/O here: the CLI
 * (scripts/testing-audit-metrics.mjs) spawns the suites and feeds these
 * functions; the unit spec pins their behavior against fixture payloads.
 */

const DEFAULT_TOP = 15

const ms = (value) => `${(value / 1000).toFixed(1)}s`

/** @returns {number} */
const fileDurationMs = (entry) => {
  if (typeof entry.endTime === 'number' && typeof entry.startTime === 'number') {
    return Math.max(0, entry.endTime - entry.startTime)
  }
  return entry.assertionResults?.reduce((sum, result) => sum + (result.duration ?? 0), 0) ?? 0
}

const slowestAssertion = (entry) =>
  (entry.assertionResults ?? [])
    .filter((result) => typeof result.duration === 'number')
    .reduce(
      (slowest, result) =>
        slowest === null || result.duration > slowest.duration ? result : slowest,
      null,
    )

/**
 * Normalize a Vitest JSON reporter payload (jest-compatible shape) into a
 * layer summary: totals plus per-file rows sorted by duration desc.
 *
 * @param {unknown} report parsed JSON from `vitest run --reporter=json`
 * @returns {{
 *   totals: { files: number, tests: number, failedTests: number, durationMs: number },
 *   rows: Array<{ file: string, tests: number, durationMs: number, slowestTest: string | null, slowestMs: number | null }>,
 * }}
 */
export const summarizeVitestReport = (report) => {
  if (!report || !Array.isArray(report.testResults)) {
    throw new Error('invalid vitest JSON report: missing testResults')
  }
  const rows = report.testResults.map((entry) => {
    const slowest = slowestAssertion(entry)
    return {
      file: String(entry.name ?? '(desconhecido)').replace(/^.*tests\//, 'tests/'),
      tests: entry.assertionResults?.length ?? 0,
      durationMs: fileDurationMs(entry),
      slowestTest: slowest ? slowest.title : null,
      slowestMs: slowest ? slowest.duration : null,
    }
  })
  rows.sort((a, b) => b.durationMs - a.durationMs)
  return {
    totals: {
      files: rows.length,
      tests: Number(report.numTotalTests ?? rows.reduce((sum, row) => sum + row.tests, 0)),
      failedTests: Number(report.numFailedTests ?? 0),
      durationMs: rows.reduce((sum, row) => sum + row.durationMs, 0),
    },
    rows,
  }
}

/**
 * Markdown table of the slowest spec files of a layer.
 *
 * @param {ReturnType<typeof summarizeVitestReport>} summary
 * @param {{ top?: number }} [options]
 */
export const renderSlowestFilesTable = (summary, { top = DEFAULT_TOP } = {}) => {
  const lines = ['| arquivo | testes | duração | teste mais lento |', '|---|---:|---:|---|']
  for (const row of summary.rows.slice(0, Math.max(0, top))) {
    const slowest =
      row.slowestTest === null ? '—' : `${row.slowestTest} (${ms(row.slowestMs ?? 0)})`
    lines.push(`| ${row.file} | ${row.tests} | ${ms(row.durationMs)} | ${slowest} |`)
  }
  return lines.join('\n')
}

/**
 * Static inventory of an e2e spec source — counting only, never execution.
 *
 * @param {{ file: string, content: string }} source
 * @returns {{ file: string, describes: number, tests: number }}
 */
export const inventoryE2ESource = ({ file, content }) => ({
  file,
  describes: (content.match(/\bdescribe\s*\(/g) ?? []).length,
  tests: (content.match(/\btest\s*\(/g) ?? []).length,
})

/** Markdown table of the static e2e inventory (durations deliberately absent). */
export const renderE2EInventoryTable = (rows) => {
  const lines = [
    '| arquivo | describes | testes | duração |',
    '|---|---:|---:|---|',
    ...rows.map(
      (row) =>
        `| ${row.file} | ${row.describes} | ${row.tests} | não medido — execução noturna proibida |`,
    ),
  ]
  return lines.join('\n')
}
