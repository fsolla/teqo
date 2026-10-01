/**
 * C242 — pure planning/reporting of `pnpm faces:index`: the argv parser, the
 * run summary, the `--verify` inventory and the human lines + JSON receipt. No
 * I/O of its own — the queue, the descriptor counts and the results arrive as
 * parameters, so the unit spec drives everything with fakes.
 */

const USAGE = 'uso: `pnpm faces:index [--apply|--verify] [--limit <n>] [--refresh] [--out <dir>]`'

export const FACE_INDEX_DEFAULT_OUT_DIR = 'data/face'

export const faceIndexReportStamp = (runAt) => String(runAt).replace(/[:.]/g, '-')

/**
 * `pnpm faces:index` argv parser — pure, so the unit spec pins it (the CLI owns
 * the exit and the help text). The default mode is the plan/dry-run.
 *
 * @param {string[]} [argv]
 * @returns {{ apply: boolean, verify: boolean, limit: number | null, refresh: boolean, out: string, help: boolean }}
 */
export const parseFaceIndexCliArgs = (argv = process.argv.slice(2)) => {
  const options = {
    apply: false,
    verify: false,
    limit: null,
    refresh: false,
    out: FACE_INDEX_DEFAULT_OUT_DIR,
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
    else if (arg === '--refresh') options.refresh = true
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${USAGE}.`)
  }

  if (options.help) return options
  if (options.apply && options.verify) {
    throw new Error(`--apply e --verify são mutuamente exclusivos — ${USAGE}.`)
  }
  if (options.limit !== null && (!Number.isSafeInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit deve ser >= 1.')
  }
  if (options.out.split(/[\\/]/).includes('..')) {
    throw new Error('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

/**
 * Aggregates one apply run: photos indexed (and how many faces each stored),
 * photos refused by the engine/IO with stage+reason.
 *
 * @param {Array<{ photoId: number, status: string, descriptorCount?: number, stage?: string | null, error?: string | null }>} results
 */
export const summarizeFaceIndexResults = (results) => {
  const failures = []
  let indexed = 0
  let failed = 0
  let descriptors = 0

  for (const result of results) {
    if (result.status === 'indexed') {
      indexed += 1
      descriptors += result.descriptorCount ?? 0
    } else if (result.status === 'failed') {
      failed += 1
      failures.push({
        photoId: result.photoId,
        stage: result.stage ?? null,
        error: result.error ?? null,
      })
    }
  }

  return { indexed, failed, descriptors, failures }
}

/**
 * The `--verify` inventory: the honest gap is `stale` — approved photos whose
 * marker is not the current index revision (never indexed or a model change).
 * `descriptors` is the stored face count of the current model.
 *
 * @param {{ queue: { indexKey: string, totalApproved: number, stale: number }, descriptors: number }} input
 */
export const summarizeFaceIndexInventory = ({ queue, descriptors }) => ({
  indexKey: queue.indexKey,
  totalApproved: queue.totalApproved,
  indexed: Math.max(0, queue.totalApproved - queue.stale),
  stale: queue.stale,
  descriptors,
})

/** One line per counted state of the inventory (pt-BR, operator-facing). */
export const formatFaceIndexInventory = (inventory, model) => [
  `[faces:index] modelo: ${model}`,
  `[faces:index] fotos aprovadas: ${inventory.totalApproved}`,
  `[faces:index] indexadas na revisão atual: ${inventory.indexed}`,
  `[faces:index] desatualizadas (a processar): ${inventory.stale}`,
  `[faces:index] rostos no índice (modelo atual): ${inventory.descriptors}`,
]

/** The receipt + human lines of one plan/apply run. */
export const formatFaceIndexReport = (report) => {
  const lines = [
    `[faces:index] modo: ${report.mode} | alvo: ${report.target} | modelo: ${report.model}`,
    `[faces:index] fila: ${report.queue.items} foto(s) a processar (aprovadas: ${report.queue.totalApproved})`,
  ]

  if (report.mode !== 'plan') {
    lines.push(
      `[faces:index] processadas: ${report.summary.indexed} | rostos indexados: ${report.summary.descriptors} | falharam: ${report.summary.failed}`,
    )
  }

  for (const failure of report.summary?.failures ?? []) {
    lines.push(`[faces:index]   ✗ foto ${failure.photoId} [${failure.stage}]: ${failure.error}`)
  }

  return lines
}
