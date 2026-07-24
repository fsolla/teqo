/**
 * E17 — Territórios de Identidade comparative rollup for the staff Início.
 *
 * First slice of the TI layer (E12 extends). Only sums and ratios of aggregates
 * — never a mean of ratios (MAUP safeguard). The Metropolitano de Salvador TI
 * is always decomposed into two sub-rows (Salvador = 19 zones, Demais RMS),
 * the permanent exception from the discovery report (24,4% of the electorate).
 *
 * This module is **client-safe** (no `server-only`, no Payload/artifact imports):
 * `computeTerritoryRollup` / `sortTerritoryRows` are pure and unit-tested with a
 * fixture. The server loader lives in `loadTerritoryOverview.ts`.
 */

const SALVADOR_CITY = 'Salvador'
const SALVADOR_SUB_LABEL = 'Salvador (19 zonas)'
const RMS_DEMAIS_SUB_LABEL = 'Demais municípios da RMS'
const METROPOLITANO_REGION = 'Metropolitano de Salvador'
const ELECTION_YEAR_2022 = '2022'

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
}

export type TerritoryOverviewSubRow = {
  label: string
  municipalityCount: number
  votesByYear: Record<string, number>
  validVotes2022: number
  estimate2026: number
  withAdvisorCount: number
  pctPropriaVotacao: number
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
}

export type TerritorySortKey =
  | 'region'
  | 'municipalities'
  | 'votes2022'
  | 'pct'
  | 'validVotes2022'
  | 'estimate2026'
  | 'coverage'

export type TerritorySortDir = 'asc' | 'desc'

type Accumulator = {
  region: string
  municipalityCount: number
  votesByYear: Record<string, number>
  validVotes2022: number
  estimate2026: number
  withAdvisorCount: number
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

const finalizeRow = (acc: Accumulator, stateTotal2022: number): TerritoryOverviewRow => ({
  region: acc.region,
  municipalityCount: acc.municipalityCount,
  votesByYear: { ...acc.votesByYear },
  validVotes2022: acc.validVotes2022,
  pctPropriaVotacao: pctOf(acc, stateTotal2022),
  estimate2026: acc.estimate2026,
  withAdvisorCount: acc.withAdvisorCount,
})

const finalizeSubRow = (
  label: string,
  acc: Accumulator,
  stateTotal2022: number,
): TerritoryOverviewSubRow => ({
  label,
  municipalityCount: acc.municipalityCount,
  votesByYear: { ...acc.votesByYear },
  validVotes2022: acc.validVotes2022,
  estimate2026: acc.estimate2026,
  withAdvisorCount: acc.withAdvisorCount,
  pctPropriaVotacao: pctOf(acc, stateTotal2022),
})

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
    // Metropolitano inputs are decomposed into the Salvador/Demais sub-rows
    // below AND rolled into the parent TI total — this is intentional, not a
    // double-count: the parent row sums all of Metropolitano, the sub-rows
    // break it down.
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
    const row = finalizeRow(acc, stateTotal2022)
    if (acc.region === METROPOLITANO_REGION) {
      row.subRows = [
        finalizeSubRow(SALVADOR_SUB_LABEL, metropolitanoSalvador, stateTotal2022),
        finalizeSubRow(RMS_DEMAIS_SUB_LABEL, metropolitanoDemais, stateTotal2022),
      ]
    }
    rows.push(row)
  }

  return rows
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
