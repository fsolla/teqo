import type { Where } from 'payload'

import { bahiaIdentityTerritories, type BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import type { CampaignUser, Municipality } from '@/payload-types'
import {
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams as CampaignListRawSearchParams,
} from '@/utilities/campaignListUrl'
import { normalizeSearchPhrase } from '@/utilities/wordStartFilter'

export const municipalityPageSize = 25

export const municipalityKindLabels: Record<Municipality['kind'], string> = {
  municipio: 'Município',
  zona: 'Zona eleitoral',
}

export const municipalityPriorityLabels: Record<NonNullable<Municipality['priority']>, string> = {
  alta: 'Prioritária',
  normal: 'Normal',
}

export type PoliticalTrendStatus = NonNullable<NonNullable<Municipality['politicalTrend']>['status']>

export const politicalTrendLabels: Record<PoliticalTrendStatus, string> = {
  favoravel: 'Favorável',
  neutra: 'Neutra',
  desfavoravel: 'Desfavorável',
}

export const politicalTrendBadgeVariant = {
  favoravel: 'estimate-confirmed',
  neutra: 'secondary',
  desfavoravel: 'destructive',
} as const

export type MunicipalityListState = {
  page: number
  q?: string
  region?: BahiaIdentityTerritory
  kind?: Municipality['kind']
  coverage?: 'com_assessor' | 'sem_assessor'
  priority?: 'alta'
  trend?: PoliticalTrendStatus
  /** Candidate number for the map comparison mode (does not filter the list). */
  compare?: number
}

export type MunicipalityListSearchParams = CampaignListRawSearchParams

export const municipalityListParamNames = [
  'q',
  'region',
  'kind',
  'coverage',
  'priority',
  'trend',
  'compare',
  'page',
] as const

const municipalityListParamNameSet = new Set<string>(municipalityListParamNames)

const canonicalTerritoryBySearchValue = new Map(
  bahiaIdentityTerritories.map((territory) => [normalizeSearchPhrase(territory), territory]),
)

export const parseMunicipalityListParams = (params: MunicipalityListSearchParams): MunicipalityListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const rawRegion = normalizedText(firstValue(params.region))
  const region = rawRegion
    ? canonicalTerritoryBySearchValue.get(normalizeSearchPhrase(rawRegion))
    : undefined
  const rawKind = firstValue(params.kind)
  const rawCoverage = firstValue(params.coverage)
  const rawPriority = firstValue(params.priority)
  const rawTrend = firstValue(params.trend)
  const rawCompare = strictDecimalInteger(firstValue(params.compare))

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(region ? { region } : {}),
    ...(rawKind === 'municipio' || rawKind === 'zona' ? { kind: rawKind } : {}),
    ...(rawCoverage === 'com_assessor' || rawCoverage === 'sem_assessor'
      ? { coverage: rawCoverage }
      : {}),
    ...(rawPriority === 'alta' ? { priority: 'alta' } : {}),
    ...(rawTrend === 'favoravel' || rawTrend === 'neutra' || rawTrend === 'desfavoravel'
      ? { trend: rawTrend }
      : {}),
    ...(rawCompare && rawCompare <= 99999 ? { compare: rawCompare } : {}),
  }
}

export const buildMunicipalityListWhere = (state: MunicipalityListState): Where => {
  const filters: Where[] = []
  const searchedZone = strictDecimalInteger(state.q)

  if (state.q) {
    const searchFilters: Where[] = [{ name: { contains: state.q } }]
    if (searchedZone && searchedZone <= 999) {
      searchFilters.push({ zoneNumber: { equals: searchedZone } })
    }
    filters.push({ or: searchFilters })
  }
  if (state.region) filters.push({ region: { equals: state.region } })
  if (state.kind) filters.push({ kind: { equals: state.kind } })
  if (state.coverage) {
    filters.push({
      advisors: { exists: state.coverage === 'com_assessor' },
    })
  }
  if (state.priority) filters.push({ priority: { equals: state.priority } })
  if (state.trend) {
    filters.push({ 'politicalTrend.status': { equals: state.trend } })
  }

  return filters.length ? { and: filters } : {}
}

export const buildMunicipalityListSearchParams = (
  state: MunicipalityListState,
  page = state.page,
): URLSearchParams => {
  const canonicalState = parseMunicipalityListParams({
    page: String(page),
    q: state.q,
    region: state.region,
    kind: state.kind,
    coverage: state.coverage,
    priority: state.priority,
    trend: state.trend,
    compare: state.compare === undefined ? undefined : String(state.compare),
  })
  const params = new URLSearchParams()

  if (canonicalState.q) params.set('q', canonicalState.q)
  if (canonicalState.region) params.set('region', canonicalState.region)
  if (canonicalState.kind) params.set('kind', canonicalState.kind)
  if (canonicalState.coverage) params.set('coverage', canonicalState.coverage)
  if (canonicalState.priority) params.set('priority', canonicalState.priority)
  if (canonicalState.trend) params.set('trend', canonicalState.trend)
  if (canonicalState.compare) params.set('compare', String(canonicalState.compare))
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))

  return params
}

export const buildMunicipalityFiltersKey = (state: MunicipalityListState): string =>
  buildMunicipalityListSearchParams(state).toString()

export const buildMunicipalityListHref = (state: MunicipalityListState, page: number): string =>
  buildListHref(state, buildMunicipalityListSearchParams, '/campanha/municipios', page)

export const shouldUpdateMunicipalitySearchUrl = (
  input: string,
  currentQ: string | undefined,
): boolean => normalizedText(input) !== currentQ

export const resolveMunicipalityListUrl = (
  params: MunicipalityListSearchParams,
  totalPages?: number,
): {
  state: MunicipalityListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: municipalityListParamNameSet,
    parse: parseMunicipalityListParams,
    buildSearchParams: buildMunicipalityListSearchParams,
    basePath: '/campanha/municipios',
    totalPages,
  })

export const municipalityListCoverageLabels: Record<NonNullable<MunicipalityListState['coverage']>, string> = {
  com_assessor: 'Com assessor',
  sem_assessor: 'Sem assessor',
}

const MAX_MUNICIPALITY_LIST_VISIT_LABEL_LENGTH = 80

export const buildMunicipalityListVisitLabel = (state: MunicipalityListState): string | null => {
  const parts: string[] = []

  if (state.region) parts.push(state.region)
  if (state.kind) parts.push(municipalityKindLabels[state.kind])
  if (state.coverage) parts.push(municipalityListCoverageLabels[state.coverage])
  if (state.priority) parts.push(municipalityPriorityLabels.alta)
  if (state.trend) parts.push(`Tendência ${politicalTrendLabels[state.trend].toLowerCase()}`)
  if (state.q) parts.push(`Busca "${state.q}"`)

  if (!parts.length) return null

  const label = `Praças · ${parts.join(' · ')}`
  if (label.length <= MAX_MUNICIPALITY_LIST_VISIT_LABEL_LENGTH) return label
  return `${label.slice(0, MAX_MUNICIPALITY_LIST_VISIT_LABEL_LENGTH - 1)}…`
}

export const buildMunicipalityListVisitHref = (state: MunicipalityListState): string =>
  buildMunicipalityListHref(state, 1)

export const getCampaignScopeLabel = (role: CampaignUser['role'], municipalityCount: number): string => {
  if (role === 'advisor') {
    return `${municipalityCount} ${municipalityCount === 1 ? 'Praça sob sua assessoria' : 'Praças sob sua assessoria'}`
  }
  if (role === 'leader') {
    return `${municipalityCount} ${municipalityCount === 1 ? 'Praça em que você atua' : 'Praças em que você atua'}`
  }
  return `${municipalityCount} ${municipalityCount === 1 ? 'Praça' : 'Praças'}`
}

/** Short human description of a municipality's geography, e.g. "Chapada Diamantina · ZE 105". */
export const formatMunicipalityGeographyLabel = (municipality: {
  region: string
  kind: Municipality['kind']
  zoneNumber?: number | null
}): string =>
  municipality.kind === 'zona' && municipality.zoneNumber != null
    ? `${municipality.region} · ZE ${municipality.zoneNumber}`
    : municipality.region
