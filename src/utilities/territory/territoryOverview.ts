/**
 * E17 — Territórios de Identidade comparative rollup for the staff Início.
 * E12 — extends rows with goal coverage, capture (MAUP), critical municipality.
 *
 * Only sums and ratios of aggregates — never a mean of ratios (MAUP safeguard).
 * The Metropolitano de Salvador TI is always decomposed into two sub-rows
 * (Salvador = 19 zones, Demais RMS).
 *
 * This module is **client-safe** (no `server-only`, no Payload imports):
 * `computeTerritoryRollup` / `sortTerritoryRows` are pure and unit-tested.
 * Territorial class is attached in `loadTerritoryOverview.ts` (B13 artifact).
 */

import { medianOf } from '@/lib/median'
import { territorialClassSortWeight } from '@/lib/territorialClassSortWeight'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'
import type { MunicipalityGoalCoverage } from '@/utilities/municipality/goalCoverage'
import { aggregateGoalCoverage } from '@/utilities/municipality/goalCoverage'
import type { MunicipalityTerritorialClassification } from '@/utilities/municipality/municipalityTerritorialClass'

export const METROPOLITANO_REGION = 'Metropolitano de Salvador'
export const SALVADOR_CITY = 'Salvador'
/** Metropolitano sub-row label — shared with `loadTerritoryOverview` for aggregate class slugs. */
export const METROPOLITANO_SALVADOR_SUB_ROW_LABEL = 'Salvador (19 zonas)'
const SALVADOR_SUB_LABEL = METROPOLITANO_SALVADOR_SUB_ROW_LABEL
const RMS_DEMAIS_SUB_LABEL = 'Demais municípios da RMS'
const ELECTION_YEAR_2022 = '2022'

type TerritoryCriticalMunicipality = {
  slug: string
  name: string
  deficit: number
}

type TerritoryCaptureBeacon = {
  slug: string
  name: string
  captureRate: number
}

/** E12 metrics shared by parent rows and Metropolitano sub-rows. */
export type TerritoryE12Rollup = {
  goalCoverage: MunicipalityGoalCoverage
  /** Σ own ÷ Σ ceiling — never the mean of per-municipality capture rates. */
  captureRate: number | null
  medianCapture: number | null
  captureMin: number | null
  captureMax: number | null
  criticalMunicipality: TerritoryCriticalMunicipality | null
  captureBeacon: TerritoryCaptureBeacon | null
}

export type TerritoryMunicipalityInput = {
  slug: string
  name: string
  city: string
  region: string
  kind: 'municipio' | 'zona'
  votesByYear: Record<string, number>
  validVotesByYear: Record<string, number>
  estimate2026: number
  advisorCount: number
  ownVotes2022: number
  fieldCeiling2022: number
  goalCoverage: MunicipalityGoalCoverage
}

type TerritoryOverviewSubRow = {
  label: string
  municipalityCount: number
  votesByYear: Record<string, number>
  validVotes2022: number
  estimate2026: number
  withAdvisorCount: number
  pctPropriaVotacao: number
} & TerritoryE12Rollup & {
    territorialClass?: MunicipalityTerritorialClassification | null
  }

export type TerritoryOverviewRow = {
  region: string
  municipalityCount: number
  votesByYear: Record<string, number>
  validVotes2022: number
  pctPropriaVotacao: number
  estimate2026: number
  withAdvisorCount: number
  subRows?: TerritoryOverviewSubRow[]
} & TerritoryE12Rollup & {
    territorialClass?: MunicipalityTerritorialClassification | null
  }

export type TerritoryTableRow =
  | ({ variant: 'parent' } & Omit<TerritoryOverviewRow, 'subRows'>)
  | ({ variant: 'sub'; parentRegion: string } & TerritoryOverviewSubRow)

export type TerritorySortKey =
  | 'region'
  | 'municipalities'
  | 'votes2022'
  | 'pct'
  | 'validVotes2022'
  | 'estimate2026'
  | 'coverage'
  | 'cobertura'
  | 'captura'
  | 'classe'

export type TerritorySortDir = 'asc' | 'desc'

type Accumulator = {
  region: string
  municipalityCount: number
  votesByYear: Record<string, number>
  validVotes2022: number
  estimate2026: number
  withAdvisorCount: number
}

/**
 * E12 rollup for a set of municipalities in one TI (or Metropolitano sub-group).
 * Exposes aggregate capture vs mean-of-ratios only through tests — UI uses aggregate.
 */
export const computeTerritoryE12Rollup = (
  inputs: ReadonlyArray<TerritoryMunicipalityInput>,
): TerritoryE12Rollup => {
  const goalCoverage = aggregateGoalCoverage(inputs.map((input) => input.goalCoverage))

  let sumOwn = 0
  let sumCeiling = 0
  const perMunicipalityRates: number[] = []
  let criticalMunicipality: TerritoryCriticalMunicipality | null = null
  let captureBeacon: TerritoryCaptureBeacon | null = null

  for (const input of inputs) {
    sumOwn += input.ownVotes2022
    sumCeiling += input.fieldCeiling2022

    if (input.fieldCeiling2022 > 0) {
      const rate = input.ownVotes2022 / input.fieldCeiling2022
      perMunicipalityRates.push(rate)
      if (!captureBeacon || rate > captureBeacon.captureRate) {
        captureBeacon = { slug: input.slug, name: input.name, captureRate: rate }
      }
    }

    if (input.goalCoverage.goal > 0) {
      if (!criticalMunicipality || input.goalCoverage.deficit > criticalMunicipality.deficit) {
        criticalMunicipality = {
          slug: input.slug,
          name: input.name,
          deficit: input.goalCoverage.deficit,
        }
      }
    }
  }

  const captureRate = sumCeiling > 0 ? sumOwn / sumCeiling : null
  const medianCapture = medianOf(perMunicipalityRates)
  const captureMin = perMunicipalityRates.length > 0 ? Math.min(...perMunicipalityRates) : null
  const captureMax = perMunicipalityRates.length > 0 ? Math.max(...perMunicipalityRates) : null

  return {
    goalCoverage,
    captureRate,
    medianCapture,
    captureMin,
    captureMax,
    criticalMunicipality,
    captureBeacon,
  }
}

/** Mean of per-municipality capture rates — MAUP alarm only; not shown in UI. */
export const meanCaptureRateOfMunicipalities = (
  inputs: ReadonlyArray<TerritoryMunicipalityInput>,
): number | null => {
  const rates = inputs
    .filter((input) => input.fieldCeiling2022 > 0)
    .map((input) => input.ownVotes2022 / input.fieldCeiling2022)
  if (rates.length === 0) return null
  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length
}

const createAccumulator = (region: string): Accumulator => ({
  region,
  municipalityCount: 0,
  votesByYear: {},
  validVotes2022: 0,
  estimate2026: 0,
  withAdvisorCount: 0,
})

const accumulateInto = (acc: Accumulator, input: TerritoryMunicipalityInput): void => {
  acc.municipalityCount += 1
  for (const [year, votes] of Object.entries(input.votesByYear)) {
    acc.votesByYear[year] = (acc.votesByYear[year] ?? 0) + votes
  }
  acc.validVotes2022 += input.validVotesByYear[ELECTION_YEAR_2022] ?? 0
  acc.estimate2026 += input.estimate2026
  if (input.advisorCount > 0) acc.withAdvisorCount += 1
}

const pctOf = (acc: Accumulator, stateTotal2022: number): number =>
  stateTotal2022 > 0 ? (acc.votesByYear[ELECTION_YEAR_2022] ?? 0) / stateTotal2022 : 0

const finalizeRow = (
  acc: Accumulator,
  stateTotal2022: number,
  e12: TerritoryE12Rollup,
): TerritoryOverviewRow => ({
  region: acc.region,
  municipalityCount: acc.municipalityCount,
  votesByYear: { ...acc.votesByYear },
  validVotes2022: acc.validVotes2022,
  pctPropriaVotacao: pctOf(acc, stateTotal2022),
  estimate2026: acc.estimate2026,
  withAdvisorCount: acc.withAdvisorCount,
  ...e12,
})

const finalizeSubRow = (
  label: string,
  acc: Accumulator,
  stateTotal2022: number,
  e12: TerritoryE12Rollup,
): TerritoryOverviewSubRow => ({
  label,
  municipalityCount: acc.municipalityCount,
  votesByYear: { ...acc.votesByYear },
  validVotes2022: acc.validVotes2022,
  estimate2026: acc.estimate2026,
  withAdvisorCount: acc.withAdvisorCount,
  pctPropriaVotacao: pctOf(acc, stateTotal2022),
  ...e12,
})

const inputsInRegion = (
  inputs: ReadonlyArray<TerritoryMunicipalityInput>,
  region: string,
): TerritoryMunicipalityInput[] => inputs.filter((input) => input.region === region)

const metropolitanoSalvadorInputs = (
  inputs: ReadonlyArray<TerritoryMunicipalityInput>,
): TerritoryMunicipalityInput[] =>
  inputs.filter((input) => input.region === METROPOLITANO_REGION && input.city === SALVADOR_CITY)

const metropolitanoDemaisInputs = (
  inputs: ReadonlyArray<TerritoryMunicipalityInput>,
): TerritoryMunicipalityInput[] =>
  inputs.filter((input) => input.region === METROPOLITANO_REGION && input.city !== SALVADOR_CITY)

/**
 * Computes the 27-TI comparative rollup. Rows are returned in first-seen order
 * (catalog order when fed from the loader); the Metropolitano de Salvador row
 * carries two sub-rows (Salvador 19 zones × Demais RMS). Use `sortTerritoryRows`
 * for display order.
 */
export const computeTerritoryRollup = (
  inputs: ReadonlyArray<TerritoryMunicipalityInput>,
): TerritoryOverviewRow[] => {
  const stateTotal2022 = inputs.reduce(
    (sum, input) => sum + (input.votesByYear[ELECTION_YEAR_2022] ?? 0),
    0,
  )

  const byRegion = new Map<string, Accumulator>()
  const metropolitanoSalvador = createAccumulator(METROPOLITANO_REGION)
  const metropolitanoDemais = createAccumulator(METROPOLITANO_REGION)

  for (const input of inputs) {
    if (input.region === METROPOLITANO_REGION) {
      if (input.city === SALVADOR_CITY) {
        accumulateInto(metropolitanoSalvador, input)
      } else {
        accumulateInto(metropolitanoDemais, input)
      }
    }
    const acc = byRegion.get(input.region) ?? createAccumulator(input.region)
    accumulateInto(acc, input)
    byRegion.set(input.region, acc)
  }

  const rows: TerritoryOverviewRow[] = []
  for (const acc of byRegion.values()) {
    const regionInputs = inputsInRegion(inputs, acc.region)
    const e12 = computeTerritoryE12Rollup(regionInputs)
    const row = finalizeRow(acc, stateTotal2022, e12)
    if (acc.region === METROPOLITANO_REGION) {
      row.subRows = [
        finalizeSubRow(
          SALVADOR_SUB_LABEL,
          metropolitanoSalvador,
          stateTotal2022,
          computeTerritoryE12Rollup(metropolitanoSalvadorInputs(inputs)),
        ),
        finalizeSubRow(
          RMS_DEMAIS_SUB_LABEL,
          metropolitanoDemais,
          stateTotal2022,
          computeTerritoryE12Rollup(metropolitanoDemaisInputs(inputs)),
        ),
      ]
    }
    rows.push(row)
  }

  return rows
}

const goalCoverageSortValue = (row: TerritoryE12Rollup): number =>
  row.goalCoverage.coverageRatio ?? -1

const classeSortValue = (row: TerritoryOverviewRow | TerritoryOverviewSubRow): number => {
  const weight = row.territorialClass
    ? territorialClassSortWeight[row.territorialClass.class]
    : null
  return weight ?? -1
}

const rowSortValue = (row: TerritoryOverviewRow, key: TerritorySortKey): number | string => {
  switch (key) {
    case 'region':
      return row.region
    case 'municipalities':
      return row.municipalityCount
    case 'votes2022':
      return row.votesByYear[ELECTION_YEAR_2022] ?? 0
    case 'pct':
      return row.pctPropriaVotacao
    case 'validVotes2022':
      return row.validVotes2022
    case 'estimate2026':
      return row.estimate2026
    case 'coverage':
      return row.municipalityCount > 0 ? row.withAdvisorCount / row.municipalityCount : 0
    case 'cobertura':
      return goalCoverageSortValue(row)
    case 'captura':
      return row.captureRate ?? -1
    case 'classe':
      return classeSortValue(row)
  }
}

/**
 * Sorts the 27 top-level rows. Metropolitano sub-rows stay attached to their
 * parent (never re-sorted independently). Returns a new array.
 */
export const sortTerritoryRows = (
  rows: ReadonlyArray<TerritoryOverviewRow>,
  key: TerritorySortKey,
  dir: TerritorySortDir = 'desc',
): TerritoryOverviewRow[] => {
  const factor = dir === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => {
    const a = rowSortValue(left, key)
    const b = rowSortValue(right, key)
    if (typeof a === 'string' || typeof b === 'string') {
      return String(a).localeCompare(String(b), 'pt-BR') * factor
    }
    return (a - b) * factor
  })
}

type TerritoryRowFilters = {
  q?: string
  regions?: readonly string[]
  coverage?: 'com_assessor' | 'sem_assessor'
}

/** Filters top-level territories; display-only sub-rows always follow their parent. */
export const filterTerritoryRows = (
  rows: ReadonlyArray<TerritoryOverviewRow>,
  filters: TerritoryRowFilters,
): TerritoryOverviewRow[] => {
  const query = filters.q ? normalizeSearchPhrase(filters.q) : ''
  const selectedRegions = new Set(filters.regions ?? [])

  return rows.filter((row) => {
    if (query && !normalizeSearchPhrase(row.region).includes(query)) return false
    if (selectedRegions.size && !selectedRegions.has(row.region)) return false
    if (filters.coverage === 'com_assessor') {
      return row.municipalityCount > 0 && row.withAdvisorCount === row.municipalityCount
    }
    if (filters.coverage === 'sem_assessor') {
      return row.withAdvisorCount < row.municipalityCount
    }
    return true
  })
}

/** Flattens display-only sub-rows while preserving their parent adjacency. */
export const flattenTerritoryRows = (
  rows: ReadonlyArray<TerritoryOverviewRow>,
): TerritoryTableRow[] =>
  rows.flatMap(({ subRows, ...row }) => [
    { ...row, variant: 'parent' as const },
    ...(subRows ?? []).map((subRow) => ({
      ...subRow,
      variant: 'sub' as const,
      parentRegion: row.region,
    })),
  ])
