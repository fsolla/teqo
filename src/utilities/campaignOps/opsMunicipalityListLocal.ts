/**
 * OH12 — pure filter / sort / page over OpsMunicipality rows for the offline
 * municipios list. Uses the same MunicipalityListState parsers produce; does
 * not invent server-only aggregates (classe / déficit / votos 2022).
 */
import type { OpsMunicipality } from '@/lib/campaignOps/opsContract'
import { engagementLevelRank, isEngagementLevel } from '@/lib/engagementLevel'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO, getVoteEstimateForScenario } from '@/lib/voteEstimate'
import { strictDecimalInteger } from '@/utilities/campaignListUrl'
import {
  municipalityPageSize,
  NO_LEVEL_FILTER_VALUE,
  resolveMunicipalityListSort,
  type MunicipalityListSortKey,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'

const TREND_SORT_RANK: Record<string, number> = {
  favoravel: 2,
  neutra: 1,
  desfavoravel: 0,
}

const OPS_MUNICIPALITY_OFFLINE_UNAVAILABLE_SORTS = new Set<MunicipalityListSortKey>([
  'votos',
  'deficit',
  'frescor',
  'classe',
])

export type OpsMunicipalityListLocalResult = {
  rows: OpsMunicipality[]
  totalDocs: number
  totalPages: number
  page: number
  /** True when URL asks for classe filter — not applied offline. */
  classFilterUnavailable: boolean
  /** True when active sort falls back to name because it needs server data. */
  sortDegraded: boolean
}

const matchesQuery = (row: OpsMunicipality, q: string): boolean => {
  const needle = q.toLocaleLowerCase('pt-BR')
  if (row.name.toLocaleLowerCase('pt-BR').includes(needle)) return true
  if (row.city.toLocaleLowerCase('pt-BR').includes(needle)) return true
  const zone = strictDecimalInteger(q)
  if (zone !== undefined && zone <= 999 && row.zoneNumber === zone) return true
  return false
}

const matchesMunicipalityFilters = (
  row: OpsMunicipality,
  state: MunicipalityListState,
): boolean => {
  if (state.q && !matchesQuery(row, state.q)) return false
  if (state.regions?.length && !state.regions.some((region) => region === row.region)) {
    return false
  }
  if (state.slugs?.length && !state.slugs.includes(row.slug)) return false
  if (state.advisors?.length) {
    const advisors = row.advisors ?? []
    if (!state.advisors.some((id) => advisors.includes(id))) return false
  }
  if (state.coverage === 'com_assessor' && !(row.advisors && row.advisors.length > 0)) return false
  if (state.coverage === 'sem_assessor' && row.advisors && row.advisors.length > 0) return false
  if (state.priority === 'alta' && row.priority !== 'alta') return false
  if (state.trends?.length) {
    const trend = row.politicalTrend?.status ?? null
    if (!trend || !state.trends.includes(trend)) return false
  }
  if (state.levels?.length) {
    const level = row.engagementLevel ?? null
    const hit = state.levels.some((value) =>
      value === NO_LEVEL_FILTER_VALUE ? level === null : level === value,
    )
    if (!hit) return false
  }
  return true
}

const compareNullableString = (left: string | null | undefined, right: string | null | undefined) =>
  (left ?? '').localeCompare(right ?? '', 'pt-BR')

const sortMunicipalityRows = (
  rows: OpsMunicipality[],
  sort: MunicipalityListSortKey,
  dir: 'asc' | 'desc',
): OpsMunicipality[] => {
  const factor = dir === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => {
    let cmp = 0
    switch (sort) {
      case 'name':
        cmp = left.name.localeCompare(right.name, 'pt-BR')
        break
      case 'region':
        cmp =
          left.region.localeCompare(right.region, 'pt-BR') ||
          left.name.localeCompare(right.name, 'pt-BR')
        break
      case 'trend': {
        const leftRank = left.politicalTrend?.status
          ? (TREND_SORT_RANK[left.politicalTrend.status] ?? -1)
          : -1
        const rightRank = right.politicalTrend?.status
          ? (TREND_SORT_RANK[right.politicalTrend.status] ?? -1)
          : -1
        cmp = leftRank - rightRank
        break
      }
      case 'expectedVotes': {
        const leftVotes =
          getVoteEstimateForScenario(left.expectedVotes, DEFAULT_VOTE_ESTIMATE_SCENARIO) ?? -1
        const rightVotes =
          getVoteEstimateForScenario(right.expectedVotes, DEFAULT_VOTE_ESTIMATE_SCENARIO) ?? -1
        cmp = leftVotes - rightVotes
        break
      }
      case 'lastUpdateAt':
        cmp = compareNullableString(left.lastUpdateAt, right.lastUpdateAt)
        break
      case 'coverage':
        cmp = (left.advisors?.length ?? 0) - (right.advisors?.length ?? 0)
        break
      case 'nivel': {
        const leftRank = isEngagementLevel(left.engagementLevel)
          ? engagementLevelRank[left.engagementLevel]
          : -1
        const rightRank = isEngagementLevel(right.engagementLevel)
          ? engagementLevelRank[right.engagementLevel]
          : -1
        cmp = leftRank - rightRank
        break
      }
      case 'votos':
      case 'deficit':
      case 'frescor':
      case 'classe':
        cmp = left.name.localeCompare(right.name, 'pt-BR')
        break
      default: {
        const _exhaustive: never = sort
        return _exhaustive
      }
    }
    if (cmp !== 0) return cmp * factor
    return left.name.localeCompare(right.name, 'pt-BR')
  })
}

export const filterSortPageOpsMunicipalities = (
  rows: ReadonlyArray<OpsMunicipality>,
  state: MunicipalityListState,
): OpsMunicipalityListLocalResult => {
  const classFilterUnavailable = Boolean(state.classes?.length)
  const filtered = rows.filter((row) => matchesMunicipalityFilters(row, state))
  const resolved = resolveMunicipalityListSort(state)
  const sortDegraded = OPS_MUNICIPALITY_OFFLINE_UNAVAILABLE_SORTS.has(resolved.sort)
  const effectiveSort: MunicipalityListSortKey = sortDegraded ? 'name' : resolved.sort
  const effectiveDir = sortDegraded ? 'asc' : resolved.dir
  const sorted = sortMunicipalityRows(filtered, effectiveSort, effectiveDir)
  const totalDocs = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalDocs / municipalityPageSize))
  const page = Math.min(Math.max(1, state.page), totalPages)
  const start = (page - 1) * municipalityPageSize
  return {
    rows: sorted.slice(start, start + municipalityPageSize),
    totalDocs,
    totalPages,
    page,
    classFilterUnavailable,
    sortDegraded,
  }
}
