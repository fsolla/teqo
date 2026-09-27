/**
 * C234 — pure planning/reporting of `pnpm faces:index`: the argv parser, the
 * run summary, the `--verify` inventory and the human lines + JSON receipt. No
 * I/O of its own — the queue, the subjects and the results arrive as
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
 * Aggregates one apply run: photos indexed (and how many subjects each linked),
 * photos refused by the engine/IO with stage+reason.
 *
 * @param {Array<{ photoId: number, status: string, matchedSubjects?: number[], stage?: string | null, error?: string | null }>} results
 */
export const summarizeFaceIndexResults = (results) => {
  const linkedBySubject = new Map()
  const failures = []
  let indexed = 0
  let failed = 0
  let linkedPhotos = 0

  for (const result of results) {
    if (result.status === 'indexed') {
      indexed += 1
      const matched = result.matchedSubjects ?? []
      if (matched.length > 0) linkedPhotos += 1
      for (const id of matched) linkedBySubject.set(id, (linkedBySubject.get(id) ?? 0) + 1)
    } else if (result.status === 'failed') {
      failed += 1
      failures.push({
        photoId: result.photoId,
        stage: result.stage ?? null,
        error: result.error ?? null,
      })
    }
  }

  return {
    indexed,
    failed,
    linkedPhotos,
    linksBySubject: [...linkedBySubject.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([subjectId, photos]) => ({ subjectId, photos })),
    failures,
  }
}

/**
 * The `--verify` inventory: the honest gap is `stale` — approved photos whose
 * marker is not the current index revision (new enrollment, new model or never
 * indexed). Consent-edited subjects are reported separately: the query already
 * fails closed on them, but the operator must see they need re-consent.
 *
 * @param {{ queue: { indexKey: string, eligibleSubjects: number, totalApproved: number, stale: number }, subjects: Array<{ id: number, status: string | null, model: string | null, consentHash: string | null, matchedPhotoIds: number[] }>, currentConsentHash: string | null }} input
 */
export const summarizeFaceIndexInventory = ({ queue, subjects, currentConsentHash }) => {
  const active = subjects.filter((subject) => subject.status === 'active')
  const staleConsent = active.filter((subject) => subject.consentHash !== currentConsentHash)
  const linksBySubject = subjects
    .filter((subject) => subject.matchedPhotoIds.length > 0)
    .map((subject) => ({ subjectId: subject.id, photos: subject.matchedPhotoIds.length }))
    .sort((a, b) => a.subjectId - b.subjectId)

  return {
    indexKey: queue.indexKey,
    totalApproved: queue.totalApproved,
    indexed: Math.max(0, queue.totalApproved - queue.stale),
    stale: queue.stale,
    // The eligibility predicate belongs to the batch owner; the inventory just
    // reports its count (a corrupted vector never counts as eligible).
    eligibleSubjects: queue.eligibleSubjects,
    activeSubjects: active.length,
    removedSubjects: subjects.length - active.length,
    staleConsentSubjects: staleConsent.length,
    linkedPhotos: linksBySubject.reduce((sum, link) => sum + link.photos, 0),
    linksBySubject,
  }
}

/** One line per counted state of the inventory (pt-BR, operator-facing). */
export const formatFaceIndexInventory = (inventory, model) => [
  `[faces:index] modelo: ${model}`,
  `[faces:index] fotos aprovadas: ${inventory.totalApproved}`,
  `[faces:index] indexadas na revisão atual: ${inventory.indexed}`,
  `[faces:index] desatualizadas (a processar): ${inventory.stale}`,
  `[faces:index] sujeitos: ${inventory.activeSubjects} ativo(s), ${inventory.removedSubjects} removido(s), ${inventory.eligibleSubjects} elegível(is)`,
  `[faces:index] sujeitos com consentimento vencido (inelegíveis até re-consentir): ${inventory.staleConsentSubjects}`,
  `[faces:index] vínculos foto↔sujeito: ${inventory.linkedPhotos}`,
  ...inventory.linksBySubject.map(
    (link) => `[faces:index]   sujeito #${link.subjectId}: ${link.photos} foto(s)`,
  ),
]

/** The receipt + human lines of one plan/apply run. */
export const formatFaceIndexReport = (report) => {
  const lines = [
    `[faces:index] modo: ${report.mode} | alvo: ${report.target} | modelo: ${report.model}`,
    `[faces:index] fila: ${report.queue.items} foto(s) a processar (aprovadas: ${report.queue.totalApproved} | sujeitos elegíveis: ${report.queue.eligibleSubjects})`,
  ]

  if (report.mode !== 'plan') {
    lines.push(
      `[faces:index] processadas: ${report.summary.indexed} | vinculadas a alguém: ${report.summary.linkedPhotos} | falharam: ${report.summary.failed}`,
    )
    for (const link of report.summary.linksBySubject) {
      lines.push(`[faces:index]   sujeito #${link.subjectId}: ${link.photos} foto(s)`)
    }
  }

  for (const failure of report.summary?.failures ?? []) {
    lines.push(`[faces:index]   ✗ foto ${failure.photoId} [${failure.stage}]: ${failure.error}`)
  }

  return lines
}
