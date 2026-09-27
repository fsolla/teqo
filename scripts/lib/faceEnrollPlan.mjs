/**
 * C234 — pure planning/reporting of `pnpm faces:enroll`: the argv parser and
 * the human lines + JSON receipt of the enrollment. No I/O of its own — the
 * engine, the Consent resolution and the Payload write arrive as parameters,
 * so the unit spec drives everything with fakes.
 */

const USAGE =
  'uso: `pnpm faces:enroll --label "<nome>" --selfie <arquivo> [--subject <id>] [--apply]`'

export const FACE_ENROLL_DEFAULT_OUT_DIR = 'data/face'

export const faceEnrollReportStamp = (runAt) => String(runAt).replace(/[:.]/g, '-')

/**
 * `pnpm faces:enroll` argv parser — pure, so the unit spec pins it (the CLI
 * owns the exit and the help text). The default mode is the plan/dry-run;
 * `--label` and `--selfie` are required in both modes so the plan shows the
 * real operation, not an abstract one.
 *
 * @param {string[]} [argv]
 * @returns {{ apply: boolean, label: string | null, selfie: string | null, subject: number | null, out: string, help: boolean }}
 */
export const parseFaceEnrollCliArgs = (argv = process.argv.slice(2)) => {
  const options = {
    apply: false,
    label: null,
    selfie: null,
    subject: null,
    out: FACE_ENROLL_DEFAULT_OUT_DIR,
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
    else if (arg === '--label') options.label = value()
    else if (arg === '--selfie') options.selfie = value()
    else if (arg === '--subject') options.subject = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${USAGE}.`)
  }

  if (options.help) return options
  if (!options.label?.trim()) throw new Error(`--label é obrigatório — ${USAGE}.`)
  if (!options.selfie?.trim()) throw new Error(`--selfie é obrigatório — ${USAGE}.`)
  if (options.subject !== null && (!Number.isSafeInteger(options.subject) || options.subject < 1)) {
    throw new Error('--subject deve ser um id >= 1.')
  }
  if (options.out.split(/[\\/]/).includes('..')) {
    throw new Error('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

/**
 * The receipt + human lines of one enrollment: what was detected (face count —
 * never the descriptor), the subject row and the consent snapshot. A refusal
 * (0 or >1 faces) is a report with `allowed: false` and its reason.
 *
 * @param {{ runAt: string, mode: string, target: string, model: string, label: string, subjectId: number | null, subjectAction: 'created' | 'updated' | null, faceCount: number, allowed: boolean, reason?: string | null, consentKey: string, consentHash: string | null, durationMs: number }} report
 */
export const formatFaceEnrollReport = (report) => {
  const lines = [
    `[faces:enroll] modo: ${report.mode} | alvo: ${report.target} | modelo: ${report.model}`,
    `[faces:enroll] selfie: ${report.faceCount} rosto(s) detectado(s)`,
  ]
  if (!report.allowed) {
    lines.push(`[faces:enroll] RECUSADO: ${report.reason ?? 'selfie fora do contrato'}`)
    return lines
  }
  if (report.subjectAction === null) {
    lines.push(`[faces:enroll] plano: ${report.label} (nada gravado; confirme com --apply)`)
    return lines
  }
  lines.push(
    `[faces:enroll] ${report.subjectAction === 'created' ? 'criada' : 'atualizada'}: #${report.subjectId} (${report.label})`,
    `[faces:enroll] consentimento: ${report.consentKey} · hash ${report.consentHash ?? '(ausente)'}`,
    `[faces:enroll] próximo passo: pnpm faces:index --apply (reprocessa as fotos aprovadas)`,
  )
  return lines
}
