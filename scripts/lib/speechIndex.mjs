/**
 * C229 — pure helpers of `pnpm acervo:index`: argument parsing, the report
 * shape/cost math and the `--probe` rendering. The DB/embedding work lives in
 * `src/utilities/speech/speechEmbeddingIndex.ts`; this module is pinned by
 * unit tests so a flag or a report line cannot drift silently.
 */

export const ACERVO_INDEX_CONFIRM_FLAG = 'ACERVO_INDEX_CONFIRM'
const DEFAULT_OUT_DIR = 'data/acervo-index'
const SPEECH_INDEX_SOURCES = ['all', 'camara', 'web']

/**
 * @param {string[]} argv
 */
export const parseSpeechIndexArgs = (argv) => {
  const options = {
    source: 'all',
    limit: null,
    dryRun: false,
    force: false,
    probe: null,
    top: 10,
    out: DEFAULT_OUT_DIR,
    help: false,
  }

  const fail = (message) => {
    throw new Error(message)
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => {
      const next = argv[++index]
      if (next === undefined || next.startsWith('--')) fail(`faltou valor para ${arg}.`)
      return next
    }
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--source') options.source = value()
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--force') options.force = true
    else if (arg === '--probe') options.probe = value()
    else if (arg === '--top') options.top = Number(value())
    else if (arg === '--out') options.out = value()
    else fail(`argumento desconhecido: ${arg}`)
  }

  if (options.help) return options
  if (!SPEECH_INDEX_SOURCES.includes(options.source)) {
    fail(`--source deve ser um de: ${SPEECH_INDEX_SOURCES.join(', ')}.`)
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    fail('--limit deve ser >= 1.')
  }
  if (!Number.isInteger(options.top) || options.top < 1) fail('--top deve ser >= 1.')
  if (options.out.includes('..')) fail('--out não pode escapar do diretório do repo (sem "..").')
  if (options.probe && (options.dryRun || options.force || options.limit !== null)) {
    fail('--probe é read-only e não combina com --dry-run/--force/--limit.')
  }
  if (options.top !== 10 && !options.probe) fail('--top só vale com --probe.')
  return options
}

/** Filesystem-safe stamp of the run instant (same shape as the other reports). */
export const speechIndexReportStamp = (iso) => iso.replace(/[:.]/g, '-')

export const speechIndexCostUsd = (promptTokens, pricePerMillionTokensUsd) =>
  (promptTokens / 1_000_000) * pricePerMillionTokensUsd

/** Rough JSON cost of the vectors: units × dims × ~8 bytes per number. */
export const speechIndexEstimatedBytes = (units, dimensions) => units * dimensions * 8

/**
 * @param {{
 *   target: string, mode: 'index' | 'dry-run', source: string,
 *   speeches: number, upToDate: number, skippedNoText: number, toIndex: number,
 *   units: number, estimatedBytes?: number, indexed?: number, failed?: number,
 *   promptTokens?: number, costUsd?: number, durationMs: number,
 * }} report
 * @returns {string[]}
 */
export const formatSpeechIndexReport = (report) => {
  const bytes =
    typeof report.estimatedBytes === 'number'
      ? ` | bytes estimados: ${(report.estimatedBytes / 1_000_000).toFixed(1)} MB`
      : ''
  const lines = [
    `[acervo:index] alvo: ${report.target} | modo: ${report.mode} | fonte: ${report.source}`,
    `falas: ${report.speeches} | atualizadas: ${report.upToDate} | sem texto: ${report.skippedNoText} | a indexar: ${report.toIndex}`,
  ]

  if (report.mode === 'index') {
    lines.push(
      `indexadas: ${report.indexed ?? 0} | falhas: ${report.failed ?? 0} | trechos vetorizados: ${report.units}${bytes} | tokens: ${report.promptTokens ?? 0} | custo estimado: US$ ${(report.costUsd ?? 0).toFixed(4)}`,
    )
  } else {
    lines.push(`trechos a vetorizar: ${report.units}${bytes}`)
  }

  lines.push(`duração: ${(report.durationMs / 1000).toFixed(1)}s`)
  return lines
}

/**
 * @param {string} term
 * @param {{ score: number, speechAt: string, sourceKey: string, origin: string }[]} hits
 * @returns {string[]}
 */
export const formatSpeechIndexProbe = (term, hits) => [
  `[acervo:index] probe "${term}" — top ${hits.length}`,
  ...hits.map(
    (hit, index) =>
      `${index + 1}. ${hit.score.toFixed(4)} · ${hit.speechAt} · ${hit.origin} · ${hit.sourceKey}`,
  ),
]
