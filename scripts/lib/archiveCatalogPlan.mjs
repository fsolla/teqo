/**
 * C232 — pure planning/reporting of the photo-archive cataloguing: the argv
 * parser, the run summaries (by outcome and by source), the catalogue
 * `--verify` inventory and the human lines + JSON receipt. No I/O of its own:
 * the queue, the engine and the Payload writes arrive as parameters, so the
 * unit spec drives everything with fakes.
 *
 * C245 adds the two-layer reading: `--metadata-only` selects the deterministic
 * layer (municipality/themes from text, no engine) in plan/apply/verify; the
 * inventory always reports BOTH layers and the verify exit follows the
 * selected one.
 */

const USAGE =
  'uso: `pnpm archive:catalog [--apply|--verify] [--metadata-only] [--limit <n>] [--out <dir>]`'

export const ARCHIVE_CATALOG_DEFAULT_OUT_DIR = 'data/archive'

/** Layer labels for the human lines and the receipt (`ai` is the default). */
export const archiveCatalogLayerLabel = (layer) => (layer === 'metadata' ? 'metadados' : 'IA')

/**
 * The pending count the `--verify` exit follows: the selected layer only —
 * metadata pending hides in the AI inventory and vice versa.
 *
 * @param {{ ai: { pending: number }, metadata: { pending: number } }} inventory
 * @param {string} layer
 * @returns {number}
 */
export const archiveCatalogPendingForLayer = (inventory, layer) =>
  layer === 'metadata' ? inventory.metadata.pending : inventory.ai.pending

export const archiveCatalogReportStamp = (runAt) => String(runAt).replace(/[:.]/g, '-')

/**
 * `pnpm archive:catalog` argv parser — pure, so the unit spec pins it (the CLI
 * owns the exit and the help text). The default mode is the plan/dry-run;
 * `--metadata-only` selects the layer without the vision engine; errors carry
 * the usage line.
 *
 * @param {string[]} [argv]
 * @returns {{ apply: boolean, verify: boolean, metadataOnly: boolean, limit: number | null, out: string, help: boolean }}
 */
export const parseArchiveCatalogCliArgs = (argv = process.argv.slice(2)) => {
  const options = {
    apply: false,
    verify: false,
    metadataOnly: false,
    limit: null,
    out: ARCHIVE_CATALOG_DEFAULT_OUT_DIR,
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
    else if (arg === '--metadata-only') options.metadataOnly = true
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--out') options.out = value()
    else throw new Error(`argumento desconhecido: ${arg} — ${USAGE}.`)
  }

  if (options.help) return options
  if (options.apply && options.verify) {
    throw new Error(`--apply e --verify são mutuamente exclusivos — ${USAGE}.`)
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit deve ser >= 1.')
  }
  if (options.out.split(/[\\/]/).includes('..')) {
    throw new Error('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

const ARCHIVE_CATALOG_SOURCE_KEYS = ['ai', 'metadata', 'none']

const emptyBySource = () => ({ ai: 0, metadata: 0, none: 0 })

/**
 * Aggregates one run: what was catalogued (and from where), what was skipped
 * (catalogued before the run) and what failed with stage+reason.
 *
 * @param {Array<{ flickrId: string, status: string, source?: string | null, stage?: string | null, error?: string | null }>} results
 */
export const summarizeArchiveCatalogResults = (results) => {
  const bySource = emptyBySource()
  const failures = []
  let cataloged = 0
  let skipped = 0
  let failed = 0

  for (const result of results) {
    if (result.status === 'cataloged') {
      cataloged += 1
      if (ARCHIVE_CATALOG_SOURCE_KEYS.includes(result.source)) bySource[result.source] += 1
    } else if (result.status === 'skipped') {
      skipped += 1
    } else {
      failed += 1
      failures.push({
        flickrId: result.flickrId,
        stage: result.stage ?? null,
        error: result.error ?? null,
      })
    }
  }

  return { cataloged, skipped, failed, bySource, failures }
}

/**
 * The `--verify` inventory over the stored rows (read-only): BOTH layers — the
 * AI catalogue (`catalogedAt`) and the metadata pass (`metadataCheckedAt`; a
 * row catalogued by the AI counts as metadata-checked because that pass runs
 * the same deterministic derivation). `pending` is the honest gap per layer,
 * `bySource` counts the last writer's provenance and each coverage counts the
 * layer that owns the field. Rows without a stored filename are the one broken
 * state C231 already checks.
 *
 * @param {any[]} rows
 */
export const summarizeArchiveCatalogInventory = (rows) => {
  const bySource = emptyBySource()
  const missingFilename = []
  let aiCataloged = 0
  let aiPending = 0
  let metadataChecked = 0
  let metadataPending = 0
  let withoutScene = 0
  let withoutMunicipality = 0

  for (const row of rows) {
    if (!row?.filename) missingFilename.push(String(row?.flickrId ?? ''))
    const catalog = row?.catalog ?? {}
    const aiDone = Boolean(catalog.catalogedAt)
    if (aiDone) {
      aiCataloged += 1
      if (!catalog.scene) withoutScene += 1
    } else {
      aiPending += 1
    }
    if (aiDone || catalog.metadataCheckedAt) {
      metadataChecked += 1
      if (catalog.municipality === undefined || catalog.municipality === null)
        withoutMunicipality += 1
    } else {
      metadataPending += 1
    }
    if (ARCHIVE_CATALOG_SOURCE_KEYS.includes(catalog.source)) bySource[catalog.source] += 1
  }

  return {
    total: rows.length,
    ai: { cataloged: aiCataloged, pending: aiPending },
    metadata: { checked: metadataChecked, pending: metadataPending },
    bySource,
    withoutScene,
    withoutMunicipality,
    missingFilename,
  }
}

const REPORT_LABEL = '[archive:catalog]'

const engineLine = (engine) =>
  engine ? `${REPORT_LABEL} engine: ${engine.host} (${engine.model}, ${engine.scope})` : null

/**
 * Human lines for stdout; the JSON file keeps the full report (the CLI already
 * announced target/mode before booting Payload). Failures are never hidden —
 * each one names its stage and reason.
 *
 * @param {Record<string, any>} report
 * @returns {string[]}
 */
export const formatArchiveCatalogReport = (report) => {
  const label = REPORT_LABEL
  const lines = []

  const engine = engineLine(report.engine)
  if (engine) lines.push(engine)
  if (report.layer) lines.push(`${label} camada: ${archiveCatalogLayerLabel(report.layer)}`)
  if (report.mode === 'plan') {
    lines.push(`${label} pendentes na fila: ${report.pending}`)
  }
  if (report.summary) {
    const { cataloged, skipped, failed, bySource } = report.summary
    const skippedLabel =
      report.layer === 'metadata' ? 'puladas (já na camada)' : 'puladas (já catalogadas)'
    lines.push(
      `${label} resultado: processadas: ${cataloged} · ${skippedLabel}: ${skipped} · falharam: ${failed}`,
    )
    lines.push(
      `${label} origem: IA: ${bySource.ai} · metadados: ${bySource.metadata} · nada a propor: ${bySource.none}`,
    )
  }
  lines.push(`${label} tempo: ${(report.durationMs / 1000).toFixed(1)}s`)

  for (const failure of report.summary?.failures ?? []) {
    lines.push(
      `  - ${failure.flickrId} (${failure.stage ?? 'desconhecido'}): ${failure.error ?? 'erro'}`,
    )
  }
  return lines
}

/** `--verify` human lines (both layers, read-only). */
export const formatArchiveCatalogInventory = (inventory) => {
  const label = REPORT_LABEL
  const lines = [
    `${label} inventário: ${inventory.total} foto(s)`,
    `${label} camada IA: catalogadas ${inventory.ai.cataloged} · pendentes ${inventory.ai.pending}`,
    `${label} camada metadados: verificadas ${inventory.metadata.checked} · pendentes ${inventory.metadata.pending}`,
    `${label} origem: IA: ${inventory.bySource.ai} · metadados: ${inventory.bySource.metadata} · nada a propor: ${inventory.bySource.none}`,
    `${label} cobertura: sem cena (IA): ${inventory.withoutScene} · sem município (metadados): ${inventory.withoutMunicipality}`,
  ]
  if (inventory.missingFilename.length > 0) {
    lines.push(`${label} sem arquivo armazenado: ${inventory.missingFilename.join(', ')}`)
  }
  if (inventory.metadata.pending > 0) {
    lines.push(`${label} pendentes de metadados: ${inventory.metadata.pending}`)
  }
  if (inventory.ai.pending > 0) {
    lines.push(`${label} pendentes de IA: ${inventory.ai.pending}`)
  }
  return lines
}
