/**
 * E4R — Import da planilha de projeção → municipality (estimativas + colunas de estratégia).
 *
 * Provenance:
 * - Canonical strategy file: docs/sheets/Mapa projeção de votos Solla 2026.xlsx (MAPA GERAL)
 * - Reference (Salvador / A×B diff): docs/sheets/Mapa_projecao_votos_Solla_2026.xlsx
 * - Sheet scenarios map Bom → otimista, Regular → média (central), Mínimo → pessimista.
 * - Fase 1 (E4R): expectedVotes + priority (overwrite nas linhas casadas).
 * - Fase 2 (2026-07-24): SITUAÇÃO → politicalTrend; DOBRADINHAS → stateDeputy + stateDeputies
 *   (+ dobradinhaNotes com a célula crua); LIDERANÇAS → contact (sem telefone) + leadership;
 *   ASSESSOR RESPONSÁVEL → campaignUser + municipality.advisors; ENCAMINHAMENTOS → nextSteps;
 *   OBSERVAÇÃO → strengths/risks (classificação curada por slug). A aba PRIORITÁRIAS sobrepõe
 *   SITUAÇÃO/LIDERANÇAS/ASSESSOR quando a célula é não-vazia. Entidades nascem name-only
 *   (usuários sem email/username/credenciais; contatos sem telefone) — ajuste manual depois.
 * - Relações (advisors, stateDeputies, municípios da liderança) são UNIÃO (nunca removem);
 *   campos de texto definidos na planilha sobrescrevem; nada é limpo quando a célula é vazia.
 * - Salvador (19 municípios-zona) é pulado para TODAS as colunas (relatório explícito).
 * - Não toca lastUpdateAt.
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

import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCliEnv } from './lib/cli.mjs'

import { getPayload } from 'payload'
import XLSX from 'xlsx'

import { assertLocalDatabase } from './assert-local-database.mjs'

loadCliEnv()

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
 *   situationRaw: string | null
 *   dobradinhasRaw: string | null
 *   leadershipsRaw: string | null
 *   advisorsRaw: string | null
 *   nextStepsRaw: string | null
 *   observationRaw: string | null
 * }} ProjectionSheetRow
 * @typedef {{
 *   situationRaw: string | null
 *   leadershipsRaw: string | null
 *   advisorsRaw: string | null
 * }} PrioritariaRow
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
  const situationCol = indexByLabel.get('SITUAÇÃO')
  const dobradinhasCol = indexByLabel.get('DOBRADINHAS')
  const leadershipsCol = indexByLabel.get('LIDERANÇAS')
  const advisorsCol = indexByLabel.get('ASSESSOR RESPONSÁVEL')
  const nextStepsCol = indexByLabel.get('ENCAMINHAMENTOS')
  const observationCol = indexByLabel.get('OBSERVAÇÃO')

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
      situationRaw: situationCol === undefined ? null : cellString(row[situationCol]),
      dobradinhasRaw: dobradinhasCol === undefined ? null : cellString(row[dobradinhasCol]),
      leadershipsRaw: leadershipsCol === undefined ? null : cellString(row[leadershipsCol]),
      advisorsRaw: advisorsCol === undefined ? null : cellString(row[advisorsCol]),
      nextStepsRaw: nextStepsCol === undefined ? null : cellString(row[nextStepsCol]),
      observationRaw: observationCol === undefined ? null : cellString(row[observationCol]),
    })
  }

  return byKey
}

/**
 * PRIORITÁRIAS rows override MAPA GERAL for SITUAÇÃO/LIDERANÇAS/ASSESSOR when non-empty.
 * @param {import('xlsx').WorkBook} workbook
 * @param {(value: string) => string} normalizeKey
 * @returns {Map<string, PrioritariaRow>}
 */
const readPrioritariaRows = (workbook, normalizeKey) => {
  const matrix = sheetMatrix(workbook, PRIORITARIAS)
  const { rowIndex, indexByLabel } = findHeaderIndex(matrix, ['MUNICÍPIO'])
  const municipalityCol = indexByLabel.get('MUNICÍPIO')
  const situationCol = indexByLabel.get('SITUAÇÃO')
  const leadershipsCol = indexByLabel.get('LIDERANÇAS')
  const advisorsCol = indexByLabel.get('ASSESSOR RESPONSÁVEL')

  /** @type {Map<string, PrioritariaRow>} */
  const byKey = new Map()

  for (let i = rowIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    const label = cellString(row[municipalityCol])
    if (!label || label.toUpperCase() === 'MUNICÍPIO') continue
    byKey.set(normalizeKey(label), {
      situationRaw: situationCol === undefined ? null : cellString(row[situationCol]),
      leadershipsRaw: leadershipsCol === undefined ? null : cellString(row[leadershipsCol]),
      advisorsRaw: advisorsCol === undefined ? null : cellString(row[advisorsCol]),
    })
  }

  return byKey
}

assertLocalDatabase(
  'seed:projecao',
  'This script overwrites municipality strategy fields from the projection sheet.',
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
const {
  parseExpectationCell,
  mapSheetPriority,
  parseSheetNumber,
  parseSituationCell,
  splitNameCell,
} = await import('../src/lib/projectionSheetParse.ts')
const {
  getVoteEstimateOrderViolation,
  toVoteEstimateScenarioViewModel,
  voteEstimatesEqual,
  voteEstimateScenarioLabels,
  hasAnyVoteEstimate,
} = await import('../src/lib/voteEstimate.ts')
const { withPayloadTransaction } = await import('../src/utilities/payloadTransaction.ts')
const { slugify } = await import('../src/lib/slug.ts')

/** @param {import('../src/lib/voteEstimate.ts').VoteEstimateScenarioViewModel} estimates */
const formatEstimates = (estimates) => {
  if (!hasAnyVoteEstimate(estimates)) return '(vazio)'
  return `${voteEstimateScenarioLabels.optimistic}:${estimates.optimistic ?? '—'} | ${voteEstimateScenarioLabels.central}:${estimates.central ?? '—'} | ${voteEstimateScenarioLabels.pessimistic}:${estimates.pessimistic ?? '—'}`
}

// ---------------------------------------------------------------------------
// Curated name resolution (adjust here when the mesa sends corrections)
// ---------------------------------------------------------------------------

/** Sheet spelling variants → canonical staff slug ("Edizio" é o CG; "Solla" é o candidato). */
const STAFF_SLUG_ALIASES = {
  mariana: 'marianna',
  joao: 'joao-lucio',
  caio: 'caio-cesar',
  solla: 'jorge-solla',
}
const COORDINATOR_SLUG = 'edizio'
const CANDIDATE_SLUG = 'jorge-solla'
const CANDIDATE_DISPLAY_NAME = 'Jorge Solla'

/** Sheet spelling variants → canonical state-deputy slug. */
const DEPUTY_SLUG_ALIASES = {
  galo: 'marcelino-galo',
  angelo: 'angelo-almeida',
  fatima: 'fatima-nunes',
  rowena: 'rowenna',
  osni: 'osny',
}

/** The candidate himself shows up in DOBRADINHAS/LIDERANÇAS cells — never an entity there. */
const CANDIDATE_NAME_SLUGS = new Set(['solla', 'sola', 'jorge-solla'])

/**
 * OBSERVAÇÃO → strengths ("Forças") or risks ("Riscos"), curated per municipality slug
 * (only 4 filled cells in the current sheet; classify new ones here when they appear).
 */
const OBSERVATION_TARGET_BY_SLUG = {
  brejoes: 'strengths', // "Prefeito se aproximou de Solla" — sinal positivo
  camacari: 'risks', // "Resolver demanda de Mutakani" — pendência aberta
  inhambupe: 'risks', // articulação com ex-prefeito ainda em construção
  laje: 'risks', // diálogo a acompanhar
}

const trendNoteFor = (situationRaw) =>
  `Importado da planilha de projeção (jul/2026) — SITUAÇÃO: ${situationRaw}`

const staffSlugFor = (name) => {
  const slug = slugify(name)
  return STAFF_SLUG_ALIASES[slug] ?? slug
}

const deputySlugFor = (name) => {
  const slug = slugify(name)
  return DEPUTY_SLUG_ALIASES[slug] ?? slug
}

/**
 * @typedef {{ variants: Map<string, number>, municipalityLabels: Set<string>, municipalityIds: Set<number>, cities: Set<string> }} RosterEntry
 */

/** @returns {RosterEntry} */
const emptyRosterEntry = () => ({
  variants: new Map(),
  municipalityLabels: new Set(),
  municipalityIds: new Set(),
  cities: new Set(),
})

/**
 * @param {Map<string, RosterEntry>} roster
 * @param {string} slug
 * @param {string} rawName
 * @param {{ label: string, id: number, city: string }} municipality
 */
const addRosterEntry = (roster, slug, rawName, municipality) => {
  let entry = roster.get(slug)
  if (!entry) {
    entry = emptyRosterEntry()
    roster.set(slug, entry)
  }
  entry.variants.set(rawName, (entry.variants.get(rawName) ?? 0) + 1)
  entry.municipalityLabels.add(municipality.label)
  entry.municipalityIds.add(municipality.id)
  entry.cities.add(municipality.city)
}

/**
 * Longest variant wins (full names beat nicknames); ties break by capitalized first
 * letter, then frequency, then accented spelling, then first-seen.
 */
const canonicalRosterName = (entry) => {
  const score = (name, count) => [
    name.length,
    /^\p{Lu}/u.test(name) ? 1 : 0,
    count,
    (name.match(/[À-ÿ]/g) ?? []).length,
  ]
  const beats = (a, b) => {
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return a[i] > b[i]
    }
    return false // full tie → keep the first-seen variant
  }
  let best = null
  let bestScore = null
  for (const [name, count] of entry.variants) {
    const nameScore = score(name, count)
    if (best === null || beats(nameScore, bestScore)) {
      best = name
      bestScore = nameScore
    }
  }
  return best ?? ''
}

const formatVariants = (entry) =>
  [...entry.variants.entries()].map(([name, count]) => `${name}×${count}`).join(', ')

const canonicalBook = XLSX.readFile(options.file, { cellDates: false })
const canonicalRows = readMapaGeralRows(canonicalBook, parseSheetNumber, normalizeMunicipalityKey)
const prioritariaRows = readPrioritariaRows(canonicalBook, normalizeMunicipalityKey)
const prioritarias = new Set(prioritariaRows.keys())

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
    advisors: true,
    stateDeputies: true,
    dobradinhaNotes: true,
    nextSteps: true,
    strengths: true,
    risks: true,
    politicalTrend: true,
  },
})

/** @type {Map<string, (typeof municipalityDocs.docs)[number]>} */
const docsBySlug = new Map()
for (const doc of municipalityDocs.docs) {
  if (typeof doc.slug === 'string') {
    docsBySlug.set(doc.slug, doc)
  }
}

const matched = []
const skippedSalvador = []
const unmatched = []
const parseErrors = []
const warnings = []
const axbDiffs = []
/** @type {Array<{ label: string, column: string, segment: string }>} */
const skippedSegments = []
/** @type {Array<{ label: string, column: string, prior: string, geral: string }>} */
const prioritariaOverrides = []

/** @type {Map<string, RosterEntry>} */
const staffRoster = new Map()
/** @type {Map<string, RosterEntry>} */
const deputyRoster = new Map()
/** @type {Map<string, RosterEntry>} */
const leadershipRoster = new Map()

const normalizeCellComparison = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase()

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

  const sheetKey = normalizeMunicipalityKey(sheetRow.municipalityLabel)
  const prioritariaRow = prioritariaRows.get(sheetKey) ?? null

  if (city === SALVADOR_CITY) {
    skippedSalvador.push({
      label: sheetRow.municipalityLabel,
      expectationRaw: sheetRow.expectationRaw,
      priorityRaw: sheetRow.priorityRaw,
      hasStrategy: Boolean(
        sheetRow.situationRaw ||
        sheetRow.dobradinhasRaw ||
        sheetRow.leadershipsRaw ||
        sheetRow.advisorsRaw ||
        sheetRow.nextStepsRaw ||
        sheetRow.observationRaw ||
        prioritariaRow,
      ),
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

  // --- Estimativas (fase 1, comportamento preservado) -----------------------
  let expectedVotes = parseExpectationCell(sheetRow.expectationRaw)
  if (!expectedVotes && sheetRow.expectationRaw) {
    parseErrors.push({
      label: sheetRow.municipalityLabel,
      slug: catalogEntry.slug,
      raw: sheetRow.expectationRaw,
    })
  }
  if (expectedVotes && getVoteEstimateOrderViolation(expectedVotes)) {
    parseErrors.push({
      label: sheetRow.municipalityLabel,
      slug: catalogEntry.slug,
      raw: `${sheetRow.expectationRaw} (ordem Otimista ≥ Média ≥ Pessimista inválida)`,
    })
    expectedVotes = null
  }

  const priority = mapSheetPriority(sheetRow.priorityRaw)

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

  if (expectedVotes && referenceRows) {
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

  // --- Estratégia (fase 2) ---------------------------------------------------
  const resolveOverride = (column, priorRaw, geralRaw) => {
    if (priorRaw != null && geralRaw != null) {
      if (normalizeCellComparison(priorRaw) !== normalizeCellComparison(geralRaw)) {
        prioritariaOverrides.push({
          label: sheetRow.municipalityLabel,
          column,
          prior: priorRaw,
          geral: geralRaw,
        })
      }
    }
    return priorRaw ?? geralRaw
  }

  const situationRaw = resolveOverride(
    'SITUAÇÃO',
    prioritariaRow?.situationRaw ?? null,
    sheetRow.situationRaw,
  )
  const leadershipsRaw = resolveOverride(
    'LIDERANÇAS',
    prioritariaRow?.leadershipsRaw ?? null,
    sheetRow.leadershipsRaw,
  )
  const advisorsRaw = resolveOverride(
    'ASSESSOR RESPONSÁVEL',
    prioritariaRow?.advisorsRaw ?? null,
    sheetRow.advisorsRaw,
  )

  const trendStatus = parseSituationCell(situationRaw)

  const municipalityRef = { label: sheetRow.municipalityLabel, id: doc.id, city }

  const advisorsSplit = splitNameCell(advisorsRaw)
  const advisorSlugs = []
  for (const name of advisorsSplit.names) {
    const slug = staffSlugFor(name)
    if (!advisorSlugs.includes(slug)) advisorSlugs.push(slug)
    addRosterEntry(staffRoster, slug, name, municipalityRef)
  }
  for (const segment of advisorsSplit.skipped) {
    skippedSegments.push({ label: sheetRow.municipalityLabel, column: 'ASSESSOR', segment })
  }

  const deputiesSplit = splitNameCell(sheetRow.dobradinhasRaw)
  const deputySlugs = []
  for (const name of deputiesSplit.names) {
    const slug = deputySlugFor(name)
    if (CANDIDATE_NAME_SLUGS.has(slug)) {
      skippedSegments.push({
        label: sheetRow.municipalityLabel,
        column: 'DOBRADINHAS',
        segment: `${name} (candidato — não vira dobradinha)`,
      })
      continue
    }
    if (!deputySlugs.includes(slug)) deputySlugs.push(slug)
    addRosterEntry(deputyRoster, slug, name, municipalityRef)
  }
  for (const segment of deputiesSplit.skipped) {
    skippedSegments.push({ label: sheetRow.municipalityLabel, column: 'DOBRADINHAS', segment })
  }

  const leadershipsSplit = splitNameCell(leadershipsRaw)
  for (const name of leadershipsSplit.names) {
    const slug = slugify(name)
    if (CANDIDATE_NAME_SLUGS.has(slug)) {
      skippedSegments.push({
        label: sheetRow.municipalityLabel,
        column: 'LIDERANÇAS',
        segment: `${name} (candidato — não vira liderança)`,
      })
      continue
    }
    addRosterEntry(leadershipRoster, slug, name, municipalityRef)
  }
  for (const segment of leadershipsSplit.skipped) {
    skippedSegments.push({ label: sheetRow.municipalityLabel, column: 'LIDERANÇAS', segment })
  }

  const observationTarget = sheetRow.observationRaw
    ? (OBSERVATION_TARGET_BY_SLUG[catalogEntry.slug] ?? null)
    : null
  if (sheetRow.observationRaw && !observationTarget) {
    warnings.push(
      `OBSERVAÇÃO sem classificação Forças/Riscos para ${sheetRow.municipalityLabel} (${catalogEntry.slug}) — adicione em OBSERVATION_TARGET_BY_SLUG: ${JSON.stringify(sheetRow.observationRaw)}`,
    )
  }

  matched.push({
    doc,
    label: sheetRow.municipalityLabel,
    expectedVotes,
    priority,
    trendStatus,
    situationRaw,
    advisorSlugs,
    deputySlugs,
    dobradinhasRaw: sheetRow.dobradinhasRaw,
    nextStepsRaw: sheetRow.nextStepsRaw,
    observationRaw: sheetRow.observationRaw,
    observationTarget,
  })
}

// ---------------------------------------------------------------------------
// Entity plans (matched against the current database, created inside the tx)
// ---------------------------------------------------------------------------

const existingUsers = await payload.find({
  collection: 'campaignUser',
  depth: 0,
  limit: 5000,
  pagination: false,
  overrideAccess: true,
  select: { name: true, role: true },
})

const usersBySlug = new Map()
for (const user of existingUsers.docs) {
  const slug = slugify(String(user.name ?? ''))
  if (!slug) continue
  if (usersBySlug.has(slug)) {
    warnings.push(
      `Usuários duplicados com o nome "${user.name}" no banco — usando o id ${usersBySlug.get(slug).id} para o match.`,
    )
    continue
  }
  usersBySlug.set(slug, user)
}
const existingCoordinators = existingUsers.docs.filter((user) => user.role === 'coordinator')
const existingCandidates = existingUsers.docs.filter((user) => user.role === 'candidate')

const staffPlans = new Map()
for (const [slug, entry] of staffRoster) {
  const role =
    slug === COORDINATOR_SLUG ? 'coordinator' : slug === CANDIDATE_SLUG ? 'candidate' : 'advisor'
  const name = slug === CANDIDATE_SLUG ? CANDIDATE_DISPLAY_NAME : canonicalRosterName(entry)
  let existing = usersBySlug.get(slug) ?? null
  if (existing && existing.role === 'leader') {
    warnings.push(
      `Usuário existente "${existing.name}" (id ${existing.id}) tem papel Liderança — não pode ser assessor; será criado um novo usuário "${name}".`,
    )
    existing = null
  }
  if (!existing && role === 'coordinator' && existingCoordinators.length === 1) {
    existing = existingCoordinators[0]
  }
  if (!existing && role === 'candidate' && existingCandidates.length === 1) {
    existing = existingCandidates[0]
  }
  staffPlans.set(slug, {
    slug,
    name,
    role,
    existing,
    userId: existing ? existing.id : null,
    entry,
  })
}

const existingDeputies = await payload.find({
  collection: 'stateDeputy',
  depth: 1,
  limit: 5000,
  pagination: false,
  overrideAccess: true,
  select: { contact: true, slug: true },
})
const deputiesBySlug = new Map(existingDeputies.docs.map((deputy) => [deputy.slug, deputy]))
const deputiesByContactName = new Map()
for (const deputy of existingDeputies.docs) {
  const contact =
    typeof deputy.contact === 'object' && deputy.contact !== null ? deputy.contact : null
  const contactNameSlug = slugify(String(contact?.name ?? ''))
  if (!contactNameSlug) continue
  const matches = deputiesByContactName.get(contactNameSlug) ?? []
  matches.push(deputy)
  deputiesByContactName.set(contactNameSlug, matches)
}
const matchedDeputyIDs = new Set()

const deputyPlans = new Map()
for (const [slug, entry] of deputyRoster) {
  const name = canonicalRosterName(entry)
  const existingBySlug = deputiesBySlug.get(slug)
  const nameMatches = (deputiesByContactName.get(slugify(name)) ?? []).filter(
    (deputy) => !matchedDeputyIDs.has(deputy.id),
  )
  const existingByName = nameMatches.length === 1 ? nameMatches[0] : null
  const existing =
    (existingBySlug && !matchedDeputyIDs.has(existingBySlug.id) ? existingBySlug : null) ??
    existingByName
  if (existing && existingBySlug?.id !== existing.id) {
    warnings.push(
      `Dobradinha "${name}" encontrada pelo nome atual do Contato; o slug legado "${existing.slug}" foi preservado.`,
    )
  }
  if (existing) matchedDeputyIDs.add(existing.id)
  deputyPlans.set(slug, {
    slug,
    name,
    existing,
    deputyId: existing ? existing.id : null,
    entry,
  })
}

const existingLeaderships = await payload.find({
  collection: 'leadership',
  depth: 1,
  limit: 5000,
  pagination: false,
  overrideAccess: true,
  select: { contact: true, municipalities: true },
})

const relationId = (value) => (typeof value === 'object' && value !== null ? value.id : value)

const leadershipsByContactSlug = new Map()
for (const leadership of existingLeaderships.docs) {
  const contact = leadership.contact
  const contactName = typeof contact === 'object' && contact !== null ? contact.name : null
  if (typeof contactName !== 'string') continue
  const slug = slugify(contactName)
  if (!slug || leadershipsByContactSlug.has(slug)) continue
  leadershipsByContactSlug.set(slug, {
    id: leadership.id,
    contactName,
    municipalityIds: (leadership.municipalities ?? []).map(relationId).filter((id) => id != null),
  })
}

const leadershipPlans = new Map()
for (const [slug, entry] of leadershipRoster) {
  const existing = leadershipsByContactSlug.get(slug) ?? null
  const municipalityIds = [...entry.municipalityIds]
  const missingIds = existing
    ? municipalityIds.filter((id) => !existing.municipalityIds.includes(id))
    : municipalityIds
  leadershipPlans.set(slug, {
    slug,
    name: canonicalRosterName(entry),
    existing,
    municipalityIds,
    missingIds,
    city: entry.cities.size === 1 ? [...entry.cities][0] : null,
    entry,
  })
}

// ---------------------------------------------------------------------------
// Municipality write plans (delta vs current DB state)
// ---------------------------------------------------------------------------

const uniqueUnion = (current, additions) => {
  const merged = [...new Set([...current, ...additions])]
  return merged.length === current.length ? null : merged
}

/** Builds the municipality update payload for a matched row (null = nothing to write). */
const buildMunicipalityData = (row) => {
  const data = {}

  if (row.expectedVotes) {
    const currentEstimates = toVoteEstimateScenarioViewModel(row.doc.expectedVotes)
    const nextEstimates = toVoteEstimateScenarioViewModel(row.expectedVotes)
    const currentPriority = row.doc.priority === 'alta' ? 'alta' : 'normal'
    if (!voteEstimatesEqual(currentEstimates, nextEstimates) || currentPriority !== row.priority) {
      data.expectedVotes = row.expectedVotes
      data.priority = row.priority
    }
  }

  if (row.trendStatus) {
    const note = trendNoteFor(row.situationRaw)
    const currentTrend = row.doc.politicalTrend ?? {}
    if (currentTrend.status !== row.trendStatus || (currentTrend.note ?? '') !== note) {
      data.politicalTrend = { status: row.trendStatus, note }
    }
  }

  if (row.advisorSlugs.length > 0) {
    const advisorIds = row.advisorSlugs
      .map((slug) => staffPlans.get(slug)?.userId)
      .filter((id) => id != null)
    const merged = uniqueUnion(row.doc.advisors ?? [], advisorIds)
    if (merged) data.advisors = merged
  }

  if (row.deputySlugs.length > 0) {
    const deputyIds = row.deputySlugs
      .map((slug) => deputyPlans.get(slug)?.deputyId)
      .filter((id) => id != null)
    const merged = uniqueUnion(row.doc.stateDeputies ?? [], deputyIds)
    if (merged) data.stateDeputies = merged
  }

  if (row.dobradinhasRaw && row.dobradinhasRaw !== (row.doc.dobradinhaNotes ?? '')) {
    data.dobradinhaNotes = row.dobradinhasRaw
  }

  if (row.nextStepsRaw && row.nextStepsRaw !== (row.doc.nextSteps ?? '')) {
    data.nextSteps = row.nextStepsRaw
  }

  if (row.observationTarget && row.observationRaw) {
    const current = row.doc[row.observationTarget] ?? []
    const text = row.observationRaw.trim()
    if (!current.some((item) => (item.text ?? '').trim() === text)) {
      data[row.observationTarget] = [
        ...current.map((item) => ({ id: item.id, text: item.text })),
        { text },
      ]
    }
  }

  return Object.keys(data).length > 0 ? data : null
}

/**
 * Pre-transaction dry-run delta: relationship ids for entities that will only exist after
 * creation are unknown here, so "will add" is inferred from the plans instead.
 */
const planSummaryFor = (row) => {
  const fields = []
  const data = buildMunicipalityData(row)
  if (data?.expectedVotes) fields.push('estimativas/prioridade')
  if (data?.politicalTrend) fields.push('tendência')
  const advisorCreates = row.advisorSlugs.some((slug) => staffPlans.get(slug)?.userId == null)
  if (data?.advisors || advisorCreates) fields.push('assessores')
  const deputyCreates = row.deputySlugs.some((slug) => deputyPlans.get(slug)?.deputyId == null)
  if (data?.stateDeputies || deputyCreates) fields.push('dobradinhas')
  if (data?.dobradinhaNotes) fields.push('dobradinhas (notas)')
  if (data?.nextSteps) fields.push('encaminhamentos')
  if (data?.strengths) fields.push('forças')
  if (data?.risks) fields.push('riscos')
  return fields
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const staffToCreate = [...staffPlans.values()].filter((plan) => plan.userId == null)
const staffMatched = [...staffPlans.values()].filter((plan) => plan.userId != null)
const deputiesToCreate = [...deputyPlans.values()].filter((plan) => plan.deputyId == null)
const leadershipsToCreate = [...leadershipPlans.values()].filter((plan) => !plan.existing)
const leadershipsToLink = [...leadershipPlans.values()].filter(
  (plan) => plan.existing && plan.missingIds.length > 0,
)

const estimateRows = matched.filter((row) => row.expectedVotes)
const trendRows = matched.filter((row) => row.trendStatus)
const municipalityPlans = matched
  .map((row) => ({ row, fields: planSummaryFor(row) }))
  .filter((plan) => plan.fields.length > 0)

console.log('\n=== E4R import projeção — relatório ===')
console.log(`Arquivo canônico: ${options.file}`)
if (referenceRows) console.log(`Arquivo referência: ${options.reference}`)
console.log(
  `Modo: ${options.dryRun ? 'DRY-RUN (sem escrita)' : 'ESCRITA (estimativas + estratégia; união em relações)'}`,
)
console.log(`Linhas MAPA GERAL (com município): ${canonicalRows.size}`)
console.log(`Casadas: ${matched.length} · com EXPECTATIVA parseável: ${estimateRows.length}`)
console.log(`Com SITUAÇÃO definida: ${trendRows.length}`)
console.log(`Salvador pulado: ${skippedSalvador.length}`)
console.log(`Não casadas: ${unmatched.length}`)
console.log(`EXPECTATIVA ilegível: ${parseErrors.length}`)
console.log(`Avisos: ${warnings.length}`)
console.log(`Divergências A×B: ${axbDiffs.length}`)
console.log(`Prioritárias na aba: ${prioritarias.size}`)
console.log(
  `Assessores: ${staffPlans.size} (criar ${staffToCreate.length}, casados ${staffMatched.length})`,
)
console.log(
  `Dobradinhas: ${deputyPlans.size} (criar ${deputiesToCreate.length}, casadas ${deputyPlans.size - deputiesToCreate.length})`,
)
console.log(
  `Lideranças: ${leadershipPlans.size} (criar ${leadershipsToCreate.length}, vincular municípios em existentes ${leadershipsToLink.length})`,
)
console.log(`Segmentos descartados nas células de nomes: ${skippedSegments.length}`)
console.log(`Overrides PRIORITÁRIAS ≠ MAPA GERAL: ${prioritariaOverrides.length}`)

if (staffPlans.size > 0) {
  console.log('\n— Assessores (coluna ASSESSOR RESPONSÁVEL) —')
  for (const plan of [...staffPlans.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const status = plan.existing
      ? `casa com usuário existente #${plan.existing.id} (${plan.existing.name}, ${plan.existing.role})`
      : `criar (papel ${plan.role}, sem credenciais)`
    const variants =
      plan.entry.variants.size > 1 ? ` · variantes: ${formatVariants(plan.entry)}` : ''
    console.log(
      `  ${plan.name}: ${status} · ${plan.entry.municipalityIds.size} município(s)${variants}`,
    )
  }
}

if (deputyPlans.size > 0) {
  console.log('\n— Dobradinhas (deputados estaduais) —')
  for (const plan of [...deputyPlans.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const status = plan.existing ? `casa com dobradinha existente #${plan.existing.id}` : 'criar'
    const variants =
      plan.entry.variants.size > 1 ? ` · variantes: ${formatVariants(plan.entry)}` : ''
    console.log(
      `  ${plan.name}: ${status} · ${plan.entry.municipalityIds.size} município(s)${variants}`,
    )
  }
}

if (leadershipPlans.size > 0) {
  console.log('\n— Lideranças (nome-only; contato sem telefone) —')
  const multiMunicipality = [...leadershipPlans.values()].filter(
    (plan) => plan.municipalityIds.length > 1,
  )
  console.log(
    `  ${leadershipsToCreate.length} nova(s), ${leadershipsToLink.length} existente(s) ganham município(s); ${multiMunicipality.length} com mais de um município (merge por nome — revisar):`,
  )
  for (const plan of multiMunicipality.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`    ${plan.name}: ${[...plan.entry.municipalityLabels].join(', ')}`)
  }
}

if (prioritariaOverrides.length > 0) {
  console.log('\n— PRIORITÁRIAS sobrepõe MAPA GERAL (aplica-se a PRIORITÁRIAS) —')
  for (const override of prioritariaOverrides) {
    console.log(
      `  ${override.label} · ${override.column}: ${JSON.stringify(override.prior)} (era ${JSON.stringify(override.geral)})`,
    )
  }
}

if (skippedSegments.length > 0) {
  console.log(
    '\n— Segmentos descartados (notas/coletivos/incertezas — permanecem só na planilha) —',
  )
  for (const skipped of skippedSegments.slice(0, 80)) {
    console.log(`  [${skipped.label}] ${skipped.column}: ${JSON.stringify(skipped.segment)}`)
  }
  if (skippedSegments.length > 80) console.log(`  … +${skippedSegments.length - 80} mais`)
}

if (skippedSalvador.length > 0) {
  console.log('\n— Salvador (pulado; estimativas e estratégia por ZE via UI) —')
  for (const row of skippedSalvador) {
    console.log(
      `  ${row.label}: ${row.expectationRaw ?? '(sem expectativa)'} · prioridade=${row.priorityRaw ?? '(vazia)'}${row.hasStrategy ? ' · colunas de estratégia ignoradas' : ''}`,
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
  console.log('\n— EXPECTATIVA não parseada (estimativa ignorada; estratégia segue) —')
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

console.log(`\nMunicípios com escrita planejada: ${municipalityPlans.length} de ${matched.length}`)
console.log('Amostra (até 8):')
for (const plan of municipalityPlans.slice(0, 8)) {
  console.log(`  ${plan.row.doc.slug}: ${plan.fields.join(', ')}`)
}

if (options.dryRun) {
  console.log('\n[seed:projecao] Dry-run concluído — nenhuma escrita.\n')
  process.exit(0)
}

try {
  const totals = await withPayloadTransaction(payload, async ({ req }) => {
    let usersCreated = 0
    for (const plan of staffPlans.values()) {
      if (plan.userId != null) continue
      const created = await payload.create({
        collection: 'campaignUser',
        data: {
          name: plan.name,
          role: plan.role,
          // Payload requires an email or username on auth creates. The reserved
          // ".invalid" TLD guarantees the address never routes; the random password
          // is never shared — an admin swaps in real credentials later.
          email: `${plan.slug}@planilha.invalid`,
          password: randomBytes(24).toString('base64url'),
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
      plan.userId = created.id
      usersCreated += 1
    }

    let deputiesCreated = 0
    for (const plan of deputyPlans.values()) {
      if (plan.deputyId != null) continue
      const contact = await payload.create({
        collection: 'contact',
        data: {
          name: plan.name,
          state: 'BA',
          city: null,
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
      const created = await payload.create({
        collection: 'stateDeputy',
        data: { contact: contact.id },
        depth: 0,
        overrideAccess: true,
        req,
      })
      plan.deputyId = created.id
      deputiesCreated += 1
    }

    let leadershipsCreated = 0
    let leadershipsLinked = 0
    for (const plan of leadershipPlans.values()) {
      if (plan.existing) {
        if (plan.missingIds.length === 0) continue
        await payload.update({
          collection: 'leadership',
          id: plan.existing.id,
          data: {
            municipalities: [...plan.existing.municipalityIds, ...plan.missingIds],
          },
          depth: 0,
          overrideAccess: true,
          req,
        })
        leadershipsLinked += 1
        continue
      }
      const contact = await payload.create({
        collection: 'contact',
        data: {
          name: plan.name,
          state: 'BA',
          city: plan.city,
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
      await payload.create({
        collection: 'leadership',
        data: {
          contact: contact.id,
          municipalities: plan.municipalityIds,
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
      leadershipsCreated += 1
    }

    let municipalitiesUpdated = 0
    for (const row of matched) {
      const data = buildMunicipalityData(row)
      if (!data) continue
      await payload.update({
        collection: 'municipality',
        id: row.doc.id,
        data,
        depth: 0,
        overrideAccess: true,
        req,
      })
      municipalitiesUpdated += 1
    }

    return {
      usersCreated,
      deputiesCreated,
      leadershipsCreated,
      leadershipsLinked,
      municipalitiesUpdated,
    }
  })

  console.log(
    `\n[seed:projecao] OK — ${totals.municipalitiesUpdated} município(s) atualizados; ` +
      `${totals.usersCreated} usuário(s), ${totals.deputiesCreated} dobradinha(s), ` +
      `${totals.leadershipsCreated} liderança(s) criados; ${totals.leadershipsLinked} liderança(s) existentes vinculadas.\n`,
  )
  process.exit(0)
} catch (error) {
  console.error(`\n[seed:projecao] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
