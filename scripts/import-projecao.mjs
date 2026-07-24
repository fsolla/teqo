/**
 * E4R — Import único da planilha de projeção → municipality.expectedVotes + priority.
 *
 * Provenance:
 * - Canonical strategy file: docs/sheets/Mapa projeção de votos Solla 2026.xlsx (MAPA GERAL)
 * - Reference (Salvador / A×B diff): docs/sheets/Mapa_projecao_votos_Solla_2026.xlsx
 * - Sheet scenarios map Bom → otimista, Regular → média (central), Mínimo → pessimista.
 * - Writes only numbers/enums (zero PII). Never creates Contact/leadership.
 * - Always overwrites expectedVotes + priority on matched rows (re-seed when the mesa
 *   sends a newer sheet over an already-populated DB). Does not touch lastUpdateAt.
 *
 * Safety: refuses non-local DATABASE_URL unless ALLOW_REMOTE_DB=true.
 *
 * Runbook:
 *   pnpm db:start
 *   pnpm db:seed:projecao -- --dry-run
 *   pnpm db:seed:projecao
 *   ALLOW_REMOTE_DB=true DATABASE_URL=<prod> pnpm db:seed:projecao -- --dry-run
 *   ALLOW_REMOTE_DB=true DATABASE_URL=<prod> pnpm db:seed:projecao
 *   pnpm db:seed:projecao -- --file path/to/newer.xlsx --dry-run
 *
 * Flags:
 *   --dry-run     Report only (no writes)
 *   --file <path> Override canonical workbook (default: docs/sheets/Mapa projeção…)
 *   --reference <path>  Override reference workbook for A×B diff
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'
import XLSX from 'xlsx'

import { assertLocalDatabase } from './assert-local-database.mjs'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const DEFAULT_CANONICAL = join(repoRoot, 'docs/sheets/Mapa projeção de votos Solla 2026.xlsx')
const DEFAULT_REFERENCE = join(repoRoot, 'docs/sheets/Mapa_projecao_votos_Solla_2026.xlsx')

const MAPA_GERAL = 'MAPA GERAL'
const PRIORITARIAS = 'PRIORITÁRIAS'
const SALVADOR_CITY = 'Salvador'

/**
 * @typedef {{ optimistic: number, central: number, pessimistic: number }} ProjectionVoteEstimates
 * @typedef {{
 *   municipalityLabel: string
 *   regionLabel: string | null
 *   votes2014: number | null
 *   votes2018: number | null
 *   votes2022: number | null
 *   expectationRaw: string | null
 *   priorityRaw: string | null
 * }} ProjectionSheetRow
 * @typedef {{ optimistic?: number | null, central?: number | null, pessimistic?: number | null } | null | undefined} DbExpectedVotes
 */

const parseArgs = (argv) => {
  const options = {
    dryRun: false,
    file: DEFAULT_CANONICAL,
    reference: DEFAULT_REFERENCE,
    referenceExplicit: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--') continue
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--file') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        throw new Error('--file requer um caminho')
      }
      options.file = resolve(next)
      i += 1
      continue
    }
    if (arg === '--reference') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        throw new Error('--reference requer um caminho')
      }
      options.reference = resolve(next)
      options.referenceExplicit = true
      i += 1
      continue
    }
    throw new Error(`Flag desconhecida: ${arg}`)
  }

  return options
}

const cellString = (value) => {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return String(value).trim() || null
}

/** @param {import('xlsx').WorkBook} workbook */
const sheetMatrix = (workbook, sheetName) => {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Aba "${sheetName}" não encontrada no workbook`)
  }
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  })
}

const findHeaderIndex = (matrix, required) => {
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    const labels = row.map((cell) => cellString(cell)?.toUpperCase() ?? '')
    if (required.every((label) => labels.includes(label.toUpperCase()))) {
      const indexByLabel = new Map()
      for (let col = 0; col < row.length; col += 1) {
        const label = cellString(row[col])
        if (label) indexByLabel.set(label.toUpperCase(), col)
      }
      return { rowIndex: i, indexByLabel }
    }
  }
  throw new Error(`Cabeçalho não encontrado (precisa de: ${required.join(', ')})`)
}

/**
 * @param {import('xlsx').WorkBook} workbook
 * @param {(raw: unknown) => number | null} parseSheetNumber
 * @param {(value: string) => string} normalizeKey
 * @returns {Map<string, ProjectionSheetRow>}
 */
const readMapaGeralRows = (workbook, parseSheetNumber, normalizeKey) => {
  const matrix = sheetMatrix(workbook, MAPA_GERAL)
  const { rowIndex, indexByLabel } = findHeaderIndex(matrix, [
    'MUNICÍPIO',
    'PRIORIDADE',
    'REGIÃO',
    'EXPECTATIVA 2026',
  ])

  const municipalityCol = indexByLabel.get('MUNICÍPIO')
  const priorityCol = indexByLabel.get('PRIORIDADE')
  const regionCol = indexByLabel.get('REGIÃO')
  const expectationCol = indexByLabel.get('EXPECTATIVA 2026')
  const votes2014Col = indexByLabel.get('VOTOS 2014')
  const votes2018Col = indexByLabel.get('VOTOS 2018')
  const votes2022Col = indexByLabel.get('VOTOS 2022')

  /** @type {Map<string, ProjectionSheetRow>} */
  const byKey = new Map()

  for (let i = rowIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    const municipalityLabel = cellString(row[municipalityCol])
    if (!municipalityLabel) continue
    if (municipalityLabel.toUpperCase() === 'MUNICÍPIO') continue
    // Footer/summary rows sometimes land in the MUNICÍPIO column (e.g. "Alta: 43 | Média: …").
    if (municipalityLabel.includes('|') || /^alta\s*:/i.test(municipalityLabel)) continue

    byKey.set(normalizeKey(municipalityLabel), {
      municipalityLabel,
      regionLabel: cellString(row[regionCol]),
      votes2014: parseSheetNumber(row[votes2014Col]),
      votes2018: parseSheetNumber(row[votes2018Col]),
      votes2022: parseSheetNumber(row[votes2022Col]),
      expectationRaw: cellString(row[expectationCol]),
      priorityRaw: cellString(row[priorityCol]),
    })
  }

  return byKey
}

/**
 * @param {import('xlsx').WorkBook} workbook
 * @param {(value: string) => string} normalizeKey
 */
const readPrioritariaNames = (workbook, normalizeKey) => {
  const matrix = sheetMatrix(workbook, PRIORITARIAS)
  const { rowIndex, indexByLabel } = findHeaderIndex(matrix, ['MUNICÍPIO'])
  const municipalityCol = indexByLabel.get('MUNICÍPIO')
  /** @type {Set<string>} */
  const names = new Set()

  for (let i = rowIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    const label = cellString(row[municipalityCol])
    if (!label || label.toUpperCase() === 'MUNICÍPIO') continue
    names.add(normalizeKey(label))
  }

  return names
}

assertLocalDatabase(
  'seed:projecao',
  'This script overwrites municipality expectedVotes/priority from the projection sheet.',
)

const options = parseArgs(process.argv.slice(2))

if (!existsSync(options.file)) {
  console.error(`\n[seed:projecao] Arquivo canônico não encontrado: ${options.file}\n`)
  process.exit(1)
}

const config = (await import('../src/payload.config.ts')).default
const { canonicalizeMunicipalityName, UnknownMunicipalityError, normalizeMunicipalityKey } =
  await import('../src/lib/electionResults.ts')
const { municipalityCatalogEntriesForCity } = await import('../src/lib/municipalityCatalog.ts')
const { getMunicipalityFederalBaseline } = await import('../src/lib/bahiaElectionAggregates.ts')
const { territoryForCity } = await import('../src/lib/bahiaTerritories.ts')
const { parseExpectationCell, mapSheetPriority, parseSheetNumber } = await import(
  '../src/lib/projectionSheetParse.ts'
)
const {
  getVoteEstimateOrderViolation,
  toVoteEstimateScenarioViewModel,
  voteEstimatesEqual,
  voteEstimateScenarioLabels,
  hasAnyVoteEstimate,
} = await import('../src/utilities/voteEstimate.ts')
const { withPayloadTransaction } = await import('../src/utilities/payloadTransaction.ts')

/** @param {import('../src/utilities/voteEstimate.ts').VoteEstimateScenarioViewModel} estimates */
const formatEstimates = (estimates) => {
  if (!hasAnyVoteEstimate(estimates)) return '(vazio)'
  return `${voteEstimateScenarioLabels.optimistic}:${estimates.optimistic ?? '—'} | ${voteEstimateScenarioLabels.central}:${estimates.central ?? '—'} | ${voteEstimateScenarioLabels.pessimistic}:${estimates.pessimistic ?? '—'}`
}
const canonicalBook = XLSX.readFile(options.file, { cellDates: false })
const canonicalRows = readMapaGeralRows(canonicalBook, parseSheetNumber, normalizeMunicipalityKey)
const prioritarias = readPrioritariaNames(canonicalBook, normalizeMunicipalityKey)

/** @type {Map<string, ProjectionSheetRow> | null} */
let referenceRows = null
const referencePath = options.reference
const referenceSameAsCanonical = resolve(referencePath) === resolve(options.file)
if (!referenceSameAsCanonical && existsSync(referencePath)) {
  try {
    referenceRows = readMapaGeralRows(
      XLSX.readFile(referencePath, { cellDates: false }),
      parseSheetNumber,
      normalizeMunicipalityKey,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (options.referenceExplicit) {
      console.error(`\n[seed:projecao] Falha ao ler --reference (${referencePath}): ${message}\n`)
      process.exit(1)
    }
    console.warn(`[seed:projecao] Planilha de referência ignorada (${referencePath}): ${message}`)
  }
} else if (options.referenceExplicit && !existsSync(referencePath)) {
  console.error(`\n[seed:projecao] --reference não encontrado: ${referencePath}\n`)
  process.exit(1)
}

const payload = await getPayload({ config })

const municipalityDocs = await payload.find({
  collection: 'municipality',
  depth: 0,
  limit: 1000,
  pagination: false,
  overrideAccess: true,
  select: {
    slug: true,
    name: true,
    city: true,
    kind: true,
    priority: true,
    expectedVotes: true,
  },
})

/** @type {Map<string, { id: number, slug: string, priority: string | null, expectedVotes: DbExpectedVotes }>} */
const docsBySlug = new Map()
for (const doc of municipalityDocs.docs) {
  if (typeof doc.slug === 'string') {
    docsBySlug.set(doc.slug, {
      id: doc.id,
      slug: doc.slug,
      priority: doc.priority ?? null,
      expectedVotes: doc.expectedVotes ?? null,
    })
  }
}

const matched = []
const skippedSalvador = []
const unmatched = []
const parseErrors = []
const warnings = []
const axbDiffs = []

for (const sheetRow of canonicalRows.values()) {
  let city
  try {
    city = canonicalizeMunicipalityName(sheetRow.municipalityLabel)
  } catch (error) {
    if (error instanceof UnknownMunicipalityError) {
      unmatched.push({
        label: sheetRow.municipalityLabel,
        reason: `nome sem mapeamento canônico: "${sheetRow.municipalityLabel}"`,
      })
      continue
    }
    throw error
  }

  if (city === SALVADOR_CITY) {
    skippedSalvador.push({
      label: sheetRow.municipalityLabel,
      expectationRaw: sheetRow.expectationRaw,
      priorityRaw: sheetRow.priorityRaw,
    })
    continue
  }

  const catalogEntries = municipalityCatalogEntriesForCity(city).filter(
    (entry) => entry.kind === 'municipio',
  )
  if (catalogEntries.length !== 1) {
    unmatched.push({
      label: sheetRow.municipalityLabel,
      reason: `catálogo retornou ${catalogEntries.length} município(s) para "${city}"`,
    })
    continue
  }

  const catalogEntry = catalogEntries[0]
  const doc = docsBySlug.get(catalogEntry.slug)
  if (!doc) {
    unmatched.push({
      label: sheetRow.municipalityLabel,
      reason: `município "${catalogEntry.slug}" não existe no banco (rode as migrations/seed do catálogo)`,
    })
    continue
  }

  const expectedVotes = parseExpectationCell(sheetRow.expectationRaw)
  if (!expectedVotes) {
    if (sheetRow.expectationRaw) {
      parseErrors.push({
        label: sheetRow.municipalityLabel,
        slug: catalogEntry.slug,
        raw: sheetRow.expectationRaw,
      })
    }
    continue
  }

  if (getVoteEstimateOrderViolation(expectedVotes)) {
    parseErrors.push({
      label: sheetRow.municipalityLabel,
      slug: catalogEntry.slug,
      raw: `${sheetRow.expectationRaw} (ordem Otimista ≥ Média ≥ Pessimista inválida)`,
    })
    continue
  }

  const priority = mapSheetPriority(sheetRow.priorityRaw)
  const sheetKey = normalizeMunicipalityKey(sheetRow.municipalityLabel)

  if (prioritarias.has(sheetKey) && priority !== 'alta') {
    warnings.push(
      `Prioritária "${sheetRow.municipalityLabel}" sem PRIORIDADE=alta no MAPA GERAL (ficará "${priority}").`,
    )
  }

  const baseline = getMunicipalityFederalBaseline(catalogEntry.slug)
  for (const [year, sheetVotes] of [
    ['2014', sheetRow.votes2014],
    ['2018', sheetRow.votes2018],
    ['2022', sheetRow.votes2022],
  ]) {
    if (sheetVotes == null) continue
    const artifactVotes = baseline.votesByYear[year] ?? 0
    if (artifactVotes !== sheetVotes) {
      warnings.push(
        `Votos ${year} divergem em ${sheetRow.municipalityLabel} (${catalogEntry.slug}): planilha=${sheetVotes}, artefato=${artifactVotes}.`,
      )
    }
  }

  const territory = territoryForCity(city)
  if (sheetRow.regionLabel && territory) {
    if (normalizeMunicipalityKey(sheetRow.regionLabel) !== normalizeMunicipalityKey(territory)) {
      warnings.push(
        `REGIÃO diverge em ${sheetRow.municipalityLabel}: planilha="${sheetRow.regionLabel}", catálogo="${territory}".`,
      )
    }
  } else if (sheetRow.regionLabel && !territory) {
    warnings.push(
      `REGIÃO da planilha sem TI no catálogo para ${sheetRow.municipalityLabel}: "${sheetRow.regionLabel}".`,
    )
  }

  if (referenceRows) {
    const ref = referenceRows.get(sheetKey)
    if (ref) {
      const refEstimates = parseExpectationCell(ref.expectationRaw)
      const refPriority = mapSheetPriority(ref.priorityRaw)
      if (
        refEstimates &&
        (!voteEstimatesEqual(
          toVoteEstimateScenarioViewModel(expectedVotes),
          toVoteEstimateScenarioViewModel(refEstimates),
        ) ||
          priority !== refPriority)
      ) {
        axbDiffs.push({
          label: sheetRow.municipalityLabel,
          a: { expectedVotes, priority },
          b: { expectedVotes: refEstimates, priority: refPriority },
        })
      }
    }
  }

  matched.push({ doc, expectedVotes, priority })
}

console.log('\n=== E4R import projeção — relatório ===')
console.log(`Arquivo canônico: ${options.file}`)
if (referenceRows) console.log(`Arquivo referência: ${options.reference}`)
console.log(
  `Modo: ${options.dryRun ? 'DRY-RUN (sem escrita)' : 'ESCRITA (overwrite expectedVotes+priority)'}`,
)
console.log(`Linhas MAPA GERAL (com município): ${canonicalRows.size}`)
console.log(`Casadas com EXPECTATIVA parseável: ${matched.length}`)
console.log(`Salvador pulado: ${skippedSalvador.length}`)
console.log(`Não casadas: ${unmatched.length}`)
console.log(`EXPECTATIVA ilegível: ${parseErrors.length}`)
console.log(`Avisos: ${warnings.length}`)
console.log(`Divergências A×B: ${axbDiffs.length}`)
console.log(`Prioritárias na aba: ${prioritarias.size}`)

if (skippedSalvador.length > 0) {
  console.log('\n— Salvador (pulado; estimativas por ZE via UI) —')
  for (const row of skippedSalvador) {
    console.log(
      `  ${row.label}: ${row.expectationRaw ?? '(sem expectativa)'} · prioridade=${row.priorityRaw ?? '(vazia)'}`,
    )
  }
}

if (unmatched.length > 0) {
  console.log('\n— Não casadas —')
  for (const row of unmatched.slice(0, 40)) {
    console.log(`  ${row.label}: ${row.reason}`)
  }
  if (unmatched.length > 40) console.log(`  … +${unmatched.length - 40} mais`)
}

if (parseErrors.length > 0) {
  console.log('\n— EXPECTATIVA não parseada (linha ignorada) —')
  for (const row of parseErrors.slice(0, 30)) {
    console.log(`  ${row.label} (${row.slug}): ${JSON.stringify(row.raw)}`)
  }
  if (parseErrors.length > 30) console.log(`  … +${parseErrors.length - 30} mais`)
}

if (axbDiffs.length > 0) {
  console.log('\n— Divergências A (canônico) × B (referência) — importa-se A —')
  for (const diff of axbDiffs) {
    console.log(
      `  ${diff.label}: A=${formatEstimates(toVoteEstimateScenarioViewModel(diff.a.expectedVotes))}/${diff.a.priority} · B=${formatEstimates(toVoteEstimateScenarioViewModel(diff.b.expectedVotes))}/${diff.b.priority}`,
    )
  }
}

if (warnings.length > 0) {
  console.log('\n— Avisos (não bloqueiam) —')
  for (const warning of warnings.slice(0, 60)) {
    console.log(`  ${warning}`)
  }
  if (warnings.length > 60) console.log(`  … +${warnings.length - 60} mais`)
}

const changing = matched.filter((row) => {
  const currentEstimates = toVoteEstimateScenarioViewModel(row.doc.expectedVotes)
  const nextEstimates = toVoteEstimateScenarioViewModel(row.expectedVotes)
  const currentPriority = row.doc.priority === 'alta' ? 'alta' : 'normal'
  return !voteEstimatesEqual(currentEstimates, nextEstimates) || currentPriority !== row.priority
})

console.log(`\nEscritas planejadas: ${matched.length} (delta vs DB: ${changing.length})`)
console.log('Amostra (até 8):')
for (const row of matched.slice(0, 8)) {
  console.log(
    `  ${row.doc.slug}: ${formatEstimates(toVoteEstimateScenarioViewModel(row.expectedVotes))} · priority=${row.priority} (DB era ${formatEstimates(
      toVoteEstimateScenarioViewModel(row.doc.expectedVotes),
    )}/${row.doc.priority ?? 'normal'})`,
  )
}

if (options.dryRun) {
  console.log('\n[seed:projecao] Dry-run concluído — nenhuma escrita.\n')
  process.exit(0)
}

try {
  await withPayloadTransaction(payload, async ({ req }) => {
    for (const row of matched) {
      await payload.update({
        collection: 'municipality',
        id: row.doc.id,
        data: {
          expectedVotes: row.expectedVotes,
          priority: row.priority,
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
    }
  })

  console.log(`\n[seed:projecao] OK — ${matched.length} município(s) atualizados (overwrite).\n`)
  process.exit(0)
} catch (error) {
  console.error(`\n[seed:projecao] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
