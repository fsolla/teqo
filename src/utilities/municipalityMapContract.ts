import { HISTORICAL_SERIES_YEARS } from '@/lib/electionResults'
import type { MunicipalitiesByIbgeCode } from '@/utilities/municipalityMapNavigation'
import type { VoteEstimateScenario } from '@/lib/voteEstimate'

/**
 * Client-safe contract of the municipality map: the bundle shape the server
 * assembles and the year/scale vocabulary the client panel renders. Keep this
 * module free of Payload/Next-server imports — client components import these
 * VALUES, so anything reachable from here ships in the browser bundle
 * (`municipalityMapData.ts` is the server-only side).
 */

export const MUNICIPALITY_MAP_YEARS = [...HISTORICAL_SERIES_YEARS, 2026] as const
export type MunicipalityMapYear = (typeof MUNICIPALITY_MAP_YEARS)[number]

export type MunicipalityMapScaleMode = 'absolute' | 'percentValid'

export const MUNICIPALITY_MAP_SCALE_MODES = [
  'percentValid',
  'absolute',
] as const satisfies readonly MunicipalityMapScaleMode[]

export const municipalityMapScaleModeLabels: Record<MunicipalityMapScaleMode, string> = {
  absolute: 'Total (votos)',
  percentValid: '% dos válidos',
}

export const municipalityMapYearLabels: Record<MunicipalityMapYear, string> = {
  2014: '2014 (TSE)',
  2018: '2018 (TSE)',
  2022: '2022 (TSE)',
  2026: '2026 (estimativas)',
}

type MunicipalityZoneBreakdownRow = {
  slug: string
  name: string
  votesByYear: Record<string, number>
  votes2026ByScenario: Record<VoteEstimateScenario, number>
}

export type MunicipalityMapComparison = {
  candidateNumber: number
  candidateName: string
  /** TSE year (as string) → codarea → (sollaVotes − otherVotes). */
  diffByYear: Record<string, Record<string, number>>
}

export type MunicipalityMapBundle = {
  /** year (as string) → codarea → value. 2026 = cenário médio (central). */
  valuesByYear: Record<string, Record<string, number>>
  /** 2026 totals per estimate scenario (codarea → votes). */
  values2026ByScenario: Record<VoteEstimateScenario, Record<string, number>>
  /** year (as string) → codarea → votosValidos (federal T1). 2026 reuses 2022. */
  validVotesByYear: Record<string, Record<string, number>>
  /** IBGE codarea → accessible municipality slugs for map click navigation. */
  municipalitiesByIbgeCode: MunicipalitiesByIbgeCode
  /** Zone municipalities in scope (Salvador) with per-year values. */
  zoneBreakdown: MunicipalityZoneBreakdownRow[]
  candidateName: string
  comparison: MunicipalityMapComparison | null
}
