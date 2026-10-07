/**
 * S46 — the pure core of the public `/potencial` story: parse the committed
 * per-UF TSE shard, find one section and compute the approved scenario.
 *
 * The shard (`public/dados/potencial-secao-2026/<UF>.json`, built by
 * `scripts/build-potencial-secoes-2026.mjs`) stores one row per polling
 * section — `[zona, seção, aptos, comparecimento, lula, flavio, válidos]` —
 * sorted by (zona, seção) inside each município, municípios sorted by code.
 * The numbers are raw; every percentage is computed here so the result panel
 * and the story image can never drift.
 *
 * Scenario (aprovado no plano de intenção, corte "todos os votos disponíveis"):
 * - 1º turno = Lula ÷ válidos × 100;
 * - X₁ = comparecimento − Lula − Flávio (nulos + brancos + TODOS os terceiros);
 * - X₂ = X₁ + faltantes = aptos − Lula − Flávio;
 * - 2º turno = (Lula + X) ÷ (Lula + X + Flávio) × 100, para X₁ e X₂;
 * - ganho = 2º − 1º, em pontos percentuais (nunca arredondado antes de subtrair).
 *
 * Fail-closed: a section without valid votes (or with impossible counts) is
 * `no-data`, never a fabricated estimate.
 */

import { slugify } from '@/lib/slug'
import { matchesNormalizedAtWordStart, normalizeSearchPhrase } from '@/lib/wordStartFilter'

export const POTENTIAL_SHARD_VERSION = 1

export const POTENTIAL_UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

export type PotentialUf = (typeof POTENTIAL_UFS)[number]

/** `[zona, seção, aptos, comparecimento, votos Lula, votos Flávio, válidos]`. */
type PotentialSectionRow = readonly [number, number, number, number, number, number, number]

type PotentialMunicipality = {
  /** TSE `CD_MUNICIPIO`. */
  code: number
  name: string
  sections: PotentialSectionRow[]
}

export type PotentialUfShard = {
  version: number
  uf: PotentialUf
  municipalities: PotentialMunicipality[]
}

/** The identity + raw numbers of one found section — the API's wire shape. */
export type PotentialSectionNumbers = {
  uf: PotentialUf
  municipalityCode: number
  municipalityName: string
  zone: number
  section: number
  aptos: number
  comparecimento: number
  lula: number
  flavio: number
  validos: number
}

export type SectionPotential = {
  /** 1º turno: Lula ÷ votos válidos × 100. */
  firstRoundPct: number
  /** 2º turno só com X₁ (votos disponíveis já no 1º turno). */
  immediatePct: number
  /** 2º turno com X₂ (X₁ + faltantes). */
  totalPct: number
  gainImmediatePp: number
  gainTotalPp: number
  x1: number
  x2: number
}

export type SectionPotentialResult =
  | { available: true; potential: SectionPotential }
  | { available: false; reason: 'no-data' }

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

const isPotentialUf = (value: string): value is PotentialUf =>
  (POTENTIAL_UFS as readonly string[]).includes(value)

/**
 * Structural validation of one shard. Runs once per UF per process (the loader
 * caches the parsed result) and fails closed: a malformed row — or one out of
 * the (code) / (zona, seção) order the binary searches assume — rejects the
 * whole shard instead of leaking a partial one.
 */
export const parsePotentialShard = (value: unknown): PotentialUfShard | null => {
  if (typeof value !== 'object' || value === null) return null
  const shard = value as Record<string, unknown>
  if (shard.version !== POTENTIAL_SHARD_VERSION) return null
  if (typeof shard.uf !== 'string' || !isPotentialUf(shard.uf)) return null
  if (!Array.isArray(shard.municipalities)) return null

  const municipalities: PotentialMunicipality[] = []
  let lastCode = -1
  for (const entry of shard.municipalities) {
    if (typeof entry !== 'object' || entry === null) return null
    const municipality = entry as Record<string, unknown>
    if (!isCount(municipality.code) || typeof municipality.name !== 'string') return null
    if (municipality.code <= lastCode) return null
    lastCode = municipality.code
    if (!Array.isArray(municipality.sections)) return null
    const sections: PotentialSectionRow[] = []
    let lastZone = -1
    let lastSection = -1
    for (const row of municipality.sections) {
      if (!Array.isArray(row) || row.length !== 7 || !row.every(isCount)) return null
      const [zone, section] = row as unknown as PotentialSectionRow
      if (zone < lastZone || (zone === lastZone && section <= lastSection)) return null
      lastZone = zone
      lastSection = section
      sections.push(row as unknown as PotentialSectionRow)
    }
    municipalities.push({ code: municipality.code, name: municipality.name, sections })
  }

  return { version: POTENTIAL_SHARD_VERSION, uf: shard.uf, municipalities }
}

/** Município lookup by TSE code — the shard is sorted by code (binary search). */
const findPotentialMunicipality = (
  shard: PotentialUfShard,
  code: number,
): PotentialMunicipality | null => {
  const municipalities = shard.municipalities
  let low = 0
  let high = municipalities.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const current = municipalities[middle]
    if (current.code === code) return current
    if (current.code < code) low = middle + 1
    else high = middle - 1
  }
  return null
}

/** Section row lookup inside one município — rows sorted by (zona, seção). */
const findPotentialSectionRow = (
  municipality: PotentialMunicipality,
  zone: number,
  section: number,
): PotentialSectionRow | null => {
  const rows = municipality.sections
  let low = 0
  let high = rows.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const row = rows[middle]
    if (row[0] === zone && row[1] === section) return row
    if (row[0] < zone || (row[0] === zone && row[1] < section)) low = middle + 1
    else high = middle - 1
  }
  return null
}

/** The full query: shard → município → section → raw numbers, or `null`. */
export const findPotentialSection = (
  shard: PotentialUfShard,
  query: { municipalityCode: number; zone: number; section: number },
): PotentialSectionNumbers | null => {
  const municipality = findPotentialMunicipality(shard, query.municipalityCode)
  if (!municipality) return null
  const row = findPotentialSectionRow(municipality, query.zone, query.section)
  if (!row) return null
  return {
    uf: shard.uf,
    municipalityCode: municipality.code,
    municipalityName: municipality.name,
    zone: row[0],
    section: row[1],
    aptos: row[2],
    comparecimento: row[3],
    lula: row[4],
    flavio: row[5],
    validos: row[6],
  }
}

/**
 * The approved scenario over one section's raw numbers. `no-data` is the only
 * alternative to a computed result: zero valid votes or impossible counts
 * (Flávio + Lula above the comparecimento, válidos above it, turnout above the
 * electorate) never render a percentage.
 */
export const computeSectionPotential = (
  numbers: Pick<
    PotentialSectionNumbers,
    'aptos' | 'comparecimento' | 'lula' | 'flavio' | 'validos'
  >,
): SectionPotentialResult => {
  const { aptos, comparecimento, lula, flavio, validos } = numbers
  if (validos <= 0) return { available: false, reason: 'no-data' }
  if (
    comparecimento > aptos ||
    validos > comparecimento ||
    lula + flavio > comparecimento ||
    lula > validos ||
    flavio > validos
  ) {
    return { available: false, reason: 'no-data' }
  }

  const x1 = comparecimento - lula - flavio
  const x2 = aptos - lula - flavio
  const firstRoundPct = (lula / validos) * 100
  // O denominador do 2º turno é (Lula + X + Flávio): X₁ fecha no comparecimento
  // e X₂ fecha no eleitorado — a conta do cenário "só Lula × Flávio".
  const immediatePct = ((lula + x1) / comparecimento) * 100
  const totalPct = ((lula + x2) / aptos) * 100

  return {
    available: true,
    potential: {
      firstRoundPct,
      immediatePct,
      totalPct,
      gainImmediatePp: immediatePct - firstRoundPct,
      gainTotalPp: totalPct - firstRoundPct,
      x1,
      x2,
    },
  }
}

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** `66,923…` → `66,9%` (one decimal, pt-BR). */
export const formatPotentialPercent = (value: number): string =>
  `${percentFormatter.format(value)}%`

/** `6,864…` → `+6,9 p.p.`; the sign is derived, never hardcoded. */
export const formatPotentialPoints = (value: number): string =>
  `${value < 0 ? '−' : '+'}${percentFormatter.format(Math.abs(value))} p.p.`

/** The downloadable PNG name: legible, ASCII, deterministic. */
export const sectionStoryFileName = (numbers: PotentialSectionNumbers): string =>
  `potencial-lula-${numbers.uf.toLowerCase()}-${slugify(numbers.municipalityName)}-z${numbers.zone}-s${numbers.section}.png`

/** The municípios of one shard, lean and alphabetical — the combobox source. */
export type PotentialMunicipalityOption = { code: number; name: string }

export const listPotentialMunicipalities = (
  shard: PotentialUfShard,
): PotentialMunicipalityOption[] =>
  shard.municipalities
    .map(({ code, name }) => ({ code, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

/**
 * The municípios whose normalized name matches `term` at a word start
 * (accent/punctuation-insensitive — o mesmo normalizador dos pickers do repo);
 * below three letters the list stays closed (design: "digite ao menos 3").
 */
export const filterPotentialMunicipalities = (
  municipalities: PotentialMunicipalityOption[],
  term: string,
): PotentialMunicipalityOption[] => {
  const needle = normalizeSearchPhrase(term)
  if (needle.length < 3) return []
  return municipalities.filter((municipality) =>
    matchesNormalizedAtWordStart(normalizeSearchPhrase(municipality.name), needle),
  )
}
