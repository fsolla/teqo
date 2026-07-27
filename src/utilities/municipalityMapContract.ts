import type { FederalCompetitiveRank } from '@/lib/bahiaElectionAggregates'
import { HISTORICAL_SERIES_YEARS } from '@/lib/electionResults'
import type { VoteEstimateScenario } from '@/lib/voteEstimate'
import type { MunicipalitiesByMapKey } from '@/utilities/municipalityMapNavigation'
import type { MunicipalityTerritorialClass } from '@/utilities/municipalityTerritorialClass'

/**
 * Client-safe contract of the municipality map: the bundle shape the server
 * assembles and the year/scale vocabulary the client panel renders. Keep this
 * module free of Payload/Next-server imports — client components import these
 * VALUES, so anything reachable from here ships in the browser bundle
 * (`municipalityMapData.ts` is the server-only side).
 */

export const MUNICIPALITY_MAP_YEARS = [...HISTORICAL_SERIES_YEARS, 2026] as const
export type MunicipalityMapYear = (typeof MUNICIPALITY_MAP_YEARS)[number]

/**
 * B13: the first three modes are RELATIVE to the candidate himself and are
 * what actually discriminate on a federal-deputy map — his best município
 * gives him ~5% of its valid votes, so `percentValid` and `absolute` paint
 * Bahia in one shade plus Salvador. The two absolute modes stay because they
 * answer "how many votes, really", which the relative ones deliberately hide.
 */
export type MunicipalityMapScaleMode =
  | 'quantile'
  | 'lq'
  | 'competitiveRank'
  | 'percentValid'
  | 'absolute'

export const MUNICIPALITY_MAP_SCALE_MODES = [
  'quantile',
  'lq',
  'competitiveRank',
  'percentValid',
  'absolute',
] as const satisfies readonly MunicipalityMapScaleMode[]

export const DEFAULT_MUNICIPALITY_MAP_SCALE_MODE: MunicipalityMapScaleMode = 'quantile'

export const municipalityMapScaleModeLabels: Record<MunicipalityMapScaleMode, string> = {
  quantile: 'Quantis (5 faixas)',
  lq: 'Padrão próprio (LQ)',
  competitiveRank: 'Posição no município',
  percentValid: '% dos válidos',
  absolute: 'Total (votos)',
}

/**
 * What the colour means, printed with the legend the scale selector describes.
 *
 * Deliberately NOT the canonical E18 `oneLiner` the list's column descriptions
 * quote: three of these five scales have a glossary entry and two do not, so
 * quoting would fork the voice inside one record — and the legend already
 * carries two to four more sentences after this one, where a standalone
 * definition ("Divide os municípios em cinco faixas…") reads as padding. The
 * "Saiba mais" link next to the note is the path to the full entry.
 */
export const municipalityMapScaleModeHints: Record<MunicipalityMapScaleMode, string> = {
  quantile: 'Cinco faixas com o mesmo número de municípios.',
  lq: 'Força local comparada ao padrão estadual do próprio candidato.',
  competitiveRank: 'Colocação dele entre os candidatos a deputado federal votados ali.',
  percentValid:
    'Participação nos votos válidos — honesta, mas comprime quase tudo numa faixa estreita.',
  absolute: 'Votos em números absolutos — favorece os municípios grandes.',
}

/** Scales that need TSE results and therefore have no 2026 reading. */
export const isMunicipalityMapScaleModeAvailable = (
  mode: MunicipalityMapScaleMode,
  year: MunicipalityMapYear,
): boolean => mode !== 'competitiveRank' || year !== 2026

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
  /** TSE year (as string) → map key → (sollaVotes − otherVotes). */
  diffByYear: Record<string, Record<string, number>>
}

/**
 * Every record below is keyed by MAP KEY, not by IBGE codarea: since B8 F2 the
 * map paints one polygon per catalog unit, so Salvador's 19 zones are addressed
 * by slug (`salvador-ze-3`) and every other município by its codarea. See
 * `mapKeyForMunicipality`.
 */
export type MunicipalityMapBundle = {
  /** year (as string) → map key → value. 2026 = cenário médio (central). */
  valuesByYear: Record<string, Record<string, number>>
  /** 2026 totals per estimate scenario (map key → votes). */
  values2026ByScenario: Record<VoteEstimateScenario, Record<string, number>>
  /** year (as string) → map key → votosValidos (federal T1). 2026 reuses 2022. */
  validVotesByYear: Record<string, Record<string, number>>
  /**
   * year (as string) → his own STATEWIDE share of valid votes: the "1×" the LQ
   * scale divides by. Statewide, never the share of the municipalities on
   * screen, so an advisor's map and the list's "Classe" column measure against
   * the same standard. 2026 reuses the 2022 standard, like `validVotesByYear`.
   */
  statewideShareByYear: Record<string, number>
  /** map key → E10 territorial class of that unit. */
  territorialClassByMapKey: Record<string, MunicipalityTerritorialClass>
  /**
   * map key → his placement among the federal-deputy candidates voted there. The
   * TSE artifact ranks by codarea only, so Salvador's zones all carry the city's
   * position (the legend says so).
   */
  competitiveRankByYear: Record<string, Record<string, FederalCompetitiveRank>>
  /** map key → projected 2026 valid votes (E8) — the size of the proportional symbol. */
  projectedValidVotesByMapKey: Record<string, number>
  /** map key → the municipality it opens on click. */
  municipalitiesByMapKey: MunicipalitiesByMapKey
  /** Zone municipalities in scope (Salvador) with per-year values. */
  zoneBreakdown: MunicipalityZoneBreakdownRow[]
  candidateName: string
  comparison: MunicipalityMapComparison | null
}
