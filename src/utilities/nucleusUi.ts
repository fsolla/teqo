import type { Where } from 'payload'

import {
  bahiaIdentityTerritories,
  bahiaMunicipalities,
  type BahiaIdentityTerritory,
  territoryForCity,
} from '@/lib/bahiaTerritories'
import type { CampaignUser, ElectoralNucleus } from '@/payload-types'
import {
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams as CampaignListRawSearchParams,
} from '@/utilities/campaignListUrl'
import { normalizeSearchPhrase } from '@/utilities/wordStartFilter'

export const nucleusPageSize = 25

export const organizationKindLabels: Record<ElectoralNucleus['organizationKind'], string> = {
  territorial: 'Territorial',
  associacao: 'Associação',
  sindicato: 'Sindicato',
  religioso: 'Religioso',
  movimento: 'Movimento',
  categoria_profissional: 'Categoria profissional',
  outro: 'Outro',
}

export const sectorKindLabels: Record<NonNullable<ElectoralNucleus['sectorKind']>, string> = {
  rural: 'Rural',
  religioso: 'Religioso',
  sindical: 'Sindical',
  empresarial: 'Empresarial',
  juventude: 'Juventude',
  saude: 'Saúde',
  educacao: 'Educação',
  cultura: 'Cultura',
  outro: 'Outro',
}

export const formatNucleusTerritoryLabel = ({
  neighborhoods = [],
  locality,
  cities = [],
  regions = [],
}: {
  neighborhoods?: string[] | null
  locality?: string | null
  cities?: string[] | null
  regions?: string[] | null
}): string =>
  [
    (neighborhoods ?? []).join(', '),
    locality,
    (cities ?? []).join(', '),
    (regions ?? []).join(', '),
  ]
    .filter(Boolean)
    .join(' · ')

export type NucleusListState = {
  page: number
  q?: string
  region?: BahiaIdentityTerritory
  city?: string
  tseZone?: number
  coverage?: 'com_coordenador' | 'sem_coordenador'
  estimate?: 'confirmada' | 'sem_confirmacao'
}

type RawSearchParams = CampaignListRawSearchParams

export const nucleusListParamNames = [
  'q',
  'region',
  'city',
  'tseZone',
  'coverage',
  'estimate',
  'page',
] as const

const nucleusListParamNameSet = new Set<string>(nucleusListParamNames)

const canonicalTerritoryBySearchValue = new Map(
  bahiaIdentityTerritories.map((territory) => [normalizeSearchPhrase(territory), territory]),
)

const canonicalMunicipalityBySearchValue = new Map(
  bahiaMunicipalities.map((city) => [normalizeSearchPhrase(city), city]),
)

const canonicalOfficialValue = <Value extends string>(
  value: string | undefined,
  canonicalValues: ReadonlyMap<string, Value>,
): Value | undefined => {
  const normalized = normalizedText(value)
  return normalized ? canonicalValues.get(normalizeSearchPhrase(normalized)) : undefined
}

export const parseNucleusListParams = (params: RawSearchParams): NucleusListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const region = canonicalOfficialValue(firstValue(params.region), canonicalTerritoryBySearchValue)
  const canonicalCity = canonicalOfficialValue(
    firstValue(params.city),
    canonicalMunicipalityBySearchValue,
  )
  const city =
    canonicalCity && (!region || territoryForCity(canonicalCity) === region)
      ? canonicalCity
      : undefined
  const rawTseZone = strictDecimalInteger(firstValue(params.tseZone))
  const rawCoverage = firstValue(params.coverage)
  const rawEstimate = firstValue(params.estimate)

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(region ? { region } : {}),
    ...(city ? { city } : {}),
    ...(rawTseZone && rawTseZone <= 999 ? { tseZone: rawTseZone } : {}),
    ...(rawCoverage === 'com_coordenador' || rawCoverage === 'sem_coordenador'
      ? { coverage: rawCoverage }
      : {}),
    ...(rawEstimate === 'confirmada' || rawEstimate === 'sem_confirmacao'
      ? { estimate: rawEstimate }
      : {}),
  }
}

export const buildNucleusListWhere = (state: NucleusListState): Where => {
  const filters: Where[] = [{ status: { equals: 'ativo' } }]
  const searchedZone = strictDecimalInteger(state.q)

  if (state.q) {
    const searchFilters: Where[] = [{ name: { contains: state.q } }]
    if (searchedZone && searchedZone <= 999) {
      searchFilters.push({ 'tseZones.zoneNumber': { equals: searchedZone } })
    }
    filters.push({ or: searchFilters })
  }
  if (state.region) filters.push({ regions: { equals: state.region } })
  if (state.city) filters.push({ cities: { equals: state.city } })
  if (state.tseZone) {
    filters.push({ 'tseZones.zoneNumber': { equals: state.tseZone } })
  }
  if (state.coverage) {
    filters.push({
      coordinators: { exists: state.coverage === 'com_coordenador' },
    })
  }
  if (state.estimate) {
    filters.push({
      confirmedVoteEstimate: { exists: state.estimate === 'confirmada' },
    })
  }

  return { and: filters }
}

export const buildNucleusListSearchParams = (
  state: NucleusListState,
  page = state.page,
): URLSearchParams => {
  const canonicalState = parseNucleusListParams({
    page: String(page),
    q: state.q,
    region: state.region,
    city: state.city,
    tseZone: state.tseZone === undefined ? undefined : String(state.tseZone),
    coverage: state.coverage,
    estimate: state.estimate,
  })
  const params = new URLSearchParams()

  if (canonicalState.q) params.set('q', canonicalState.q)
  if (canonicalState.region) params.set('region', canonicalState.region)
  if (canonicalState.city) params.set('city', canonicalState.city)
  if (canonicalState.tseZone) params.set('tseZone', String(canonicalState.tseZone))
  if (canonicalState.coverage) params.set('coverage', canonicalState.coverage)
  if (canonicalState.estimate) params.set('estimate', canonicalState.estimate)
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))

  return params
}

export const buildNucleusFiltersKey = (state: NucleusListState): string =>
  buildNucleusListSearchParams(state).toString()

export const buildNucleusListHref = (state: NucleusListState, page: number): string =>
  buildListHref(state, buildNucleusListSearchParams, '/campanha/nucleos', page)

export const resolveNucleusListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): {
  state: NucleusListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: nucleusListParamNameSet,
    parse: parseNucleusListParams,
    buildSearchParams: buildNucleusListSearchParams,
    basePath: '/campanha/nucleos',
    totalPages,
  })

export const nucleusListCoverageLabels: Record<NonNullable<NucleusListState['coverage']>, string> = {
  com_coordenador: 'Com coordenador',
  sem_coordenador: 'Sem coordenador',
}

export const nucleusListEstimateLabels: Record<NonNullable<NucleusListState['estimate']>, string> = {
  confirmada: 'Confirmada',
  sem_confirmacao: 'Sem confirmação',
}

const nucleusListVisitEstimateLabels: Record<NonNullable<NucleusListState['estimate']>, string> = {
  ...nucleusListEstimateLabels,
  confirmada: 'Estimativa confirmada',
}

const MAX_NUCLEUS_LIST_VISIT_LABEL_LENGTH = 80

export const buildNucleusListVisitLabel = (state: NucleusListState): string | null => {
  const parts: string[] = []

  if (state.region) parts.push(state.region)
  if (state.city) parts.push(state.city)
  if (state.tseZone) parts.push(`Zona ${state.tseZone}`)
  if (state.coverage) parts.push(nucleusListCoverageLabels[state.coverage])
  if (state.estimate) parts.push(nucleusListVisitEstimateLabels[state.estimate])
  if (state.q) parts.push(`Busca "${state.q}"`)

  if (!parts.length) return null

  const label = `Núcleos · ${parts.join(' · ')}`
  if (label.length <= MAX_NUCLEUS_LIST_VISIT_LABEL_LENGTH) return label
  return `${label.slice(0, MAX_NUCLEUS_LIST_VISIT_LABEL_LENGTH - 1)}…`
}

export const buildNucleusListVisitHref = (state: NucleusListState): string =>
  buildNucleusListHref(state, 1)

export const getCampaignScopeLabel = (role: CampaignUser['role'], nucleusCount: number): string => {
  if (role === 'coordenador') {
    return `${nucleusCount} ${nucleusCount === 1 ? 'núcleo' : 'núcleos'} sob sua coordenação`
  }
  if (role === 'lideranca') {
    return `${nucleusCount} ${nucleusCount === 1 ? 'núcleo em que você atua' : 'núcleos em que você atua'}`
  }
  return `${nucleusCount} ${nucleusCount === 1 ? 'núcleo ativo' : 'núcleos ativos'}`
}
