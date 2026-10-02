/**
 * C244 — pure planning/reporting of `pnpm faces:enroll-figure`: the argv
 * parser, the slug contract and the human lines/receipt stamp. No I/O of its
 * own, so the unit spec drives everything with fakes.
 */
import { SLUG_PATTERN } from '../../src/lib/slug.ts'

const USAGE =
  'uso: `pnpm faces:enroll-figure --figure <slug> [--name "Nome"] [--full-name "Nome completo"] [--source "Origem"] --image <arquivo> [--image <arquivo>]... [--replace] [--apply] [--out <dir>]`'

export const FACE_FIGURE_DEFAULT_OUT_DIR = 'data/face'

/**
 * `pnpm faces:enroll-figure` argv parser — pure, so the unit spec pins it (the
 * CLI owns the exit and the help text). The default mode is the plan/dry-run.
 *
 * @param {string[]} [argv]
 * @returns {{
 *   figure: string | null,
 *   name: string | null,
 *   fullName: string | null,
 *   source: string | null,
 *   images: string[],
 *   replace: boolean,
 *   apply: boolean,
 *   out: string,
 *   help: boolean,
 * }}
 */
export const parseEnrollFigureArgs = (argv = process.argv.slice(2)) => {
  const options = {
    figure: null,
    name: null,
    fullName: null,
    source: null,
    images: [],
    replace: false,
    apply: false,
    out: FACE_FIGURE_DEFAULT_OUT_DIR,
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
    else if (arg === '--replace') options.replace = true
    else if (arg === '--figure') options.figure = value()
    else if (arg === '--name') options.name = value()
    else if (arg === '--full-name') options.fullName = value()
    else if (arg === '--source') options.source = value()
    else if (arg === '--image') options.images.push(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${USAGE}.`)
  }

  if (options.help) return options
  if (!options.figure || !SLUG_PATTERN.test(options.figure)) {
    throw new Error(`--figure deve ser um slug (ex.: lula) — ${USAGE}.`)
  }
  if (options.images.length === 0) {
    throw new Error(`pelo menos um --image é obrigatório — ${USAGE}.`)
  }
  if (options.out.split(/[\\/]/).includes('..')) {
    throw new Error('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

/** Receipt filename stamp (same contract as `faces:index`). */
export const faceFigureReportStamp = (runAt) => String(runAt).replace(/[:.]/g, '-')

/** The human lines of one enrollment run (plan or apply). */
export const formatEnrollFigureReport = (report) => {
  const lines = [
    `[faces:enroll-figure] modo: ${report.mode} | figura: ${report.figure} | modelo: ${report.model}`,
    `[faces:enroll-figure] figura ${report.action} | referências: ${report.referencesBefore} → ${report.referencesAfter}`,
    `[faces:enroll-figure] imagens: ${report.images.join(', ')}`,
    `[faces:enroll-figure] bust da tag: POST /api/revalidate?tag=archivePhotos`,
  ]
  return lines
}
