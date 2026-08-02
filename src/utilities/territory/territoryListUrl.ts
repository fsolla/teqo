import { type BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import {
  createSortToggleHref,
  firstValue,
  inspectRawListParams,
  normalizedText,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'
import type { TerritorySortDir, TerritorySortKey } from '@/utilities/territory/territoryOverview'
import { parseTerritoryRegionsParam } from '@/utilities/territory/territoryRegionParam'

export type TerritoryListSortKey = TerritorySortKey
export type TerritoryListSortDirection = TerritorySortDir
export type TerritoryCoverage = 'com_assessor' | 'sem_assessor'

export type TerritoryListState = {
  q?: string
  regions?: BahiaIdentityTerritory[]
  coverage?: TerritoryCoverage
  sort?: TerritoryListSortKey
  dir?: TerritoryListSortDirection
}

export type TerritoryListSearchParams = RawSearchParams

const territoryListParamNames = ['q', 'region', 'coverage', 'sort', 'dir'] as const
const territoryListParamNameSet = new Set<string>(territoryListParamNames)
const territoryListSortKeys: TerritoryListSortKey[] = [
  'region',
  'municipalities',
  'votes2022',
  'pct',
  'validVotes2022',
  'estimate2026',
  'coverage',
  'cobertura',
  'captura',
  'classe',
]
const territoryListSortKeySet = new Set<string>(territoryListSortKeys)
const territoryListSortDirSet = new Set<TerritoryListSortDirection>(['asc', 'desc'])
const DEFAULT_TERRITORY_LIST_SORT_KEY: TerritoryListSortKey = 'pct'
const DEFAULT_TERRITORY_LIST_SORT_DIR: TerritoryListSortDirection = 'desc'

export const territoryListSortLabels: Record<TerritoryListSortKey, string> = {
  region: 'Território',
  municipalities: 'Municípios',
  votes2022: 'Votos 2022',
  pct: '% da própria votação',
  validVotes2022: 'Válidos 2022',
  estimate2026: 'Estimativa 2026 (média)',
  coverage: 'Assessoria',
  cobertura: 'Cobertura da meta',
  captura: 'Captura (2022)',
  classe: 'Classe',
}

const parseRegions = parseTerritoryRegionsParam

export const defaultTerritoryListSortDir = (
  key: TerritoryListSortKey,
): TerritoryListSortDirection => {
  if (key === 'region') return 'asc'
  return 'desc'
}

export const resolveTerritoryListSort = (
  state: TerritoryListState,
): { sort: TerritoryListSortKey; dir: TerritoryListSortDirection } => {
  const sort = state.sort ?? DEFAULT_TERRITORY_LIST_SORT_KEY
  return { sort, dir: state.dir ?? defaultTerritoryListSortDir(sort) }
}

export const formatTerritoryListSortSummary = (
  sort: TerritoryListSortKey,
  dir: TerritoryListSortDirection,
): string => {
  if (sort === 'region') {
    return dir === 'asc' ? 'Ordenado por território (A–Z)' : 'Ordenado por território (Z–A)'
  }
  return `Ordenado por ${territoryListSortLabels[sort]} (${dir === 'asc' ? 'menor primeiro' : 'maior primeiro'})`
}

export const parseTerritoryListParams = (params: TerritoryListSearchParams): TerritoryListState => {
  const q = normalizedText(firstValue(params.q))
  const regions = parseRegions(params.region)
  const rawCoverage = firstValue(params.coverage)
  const rawSort = firstValue(params.sort)
  const rawDir = firstValue(params.dir)

  return {
    ...(q ? { q } : {}),
    ...(regions.length ? { regions } : {}),
    ...(rawCoverage === 'com_assessor' || rawCoverage === 'sem_assessor'
      ? { coverage: rawCoverage }
      : {}),
    ...(rawSort && territoryListSortKeySet.has(rawSort)
      ? { sort: rawSort as TerritoryListSortKey }
      : {}),
    ...(rawDir && territoryListSortDirSet.has(rawDir as TerritoryListSortDirection)
      ? { dir: rawDir as TerritoryListSortDirection }
      : {}),
  }
}

export const territoryListStateToRawParams = (
  state: TerritoryListState,
): TerritoryListSearchParams => ({
  q: state.q,
  region: state.regions,
  coverage: state.coverage,
  sort: state.sort,
  dir: state.dir,
})

export const serializeTerritoryListSearchParams = (state: TerritoryListState): URLSearchParams => {
  const canonical = parseTerritoryListParams(territoryListStateToRawParams(state))
  const { sort, dir } = resolveTerritoryListSort(canonical)
  const params = new URLSearchParams()

  if (canonical.q) params.set('q', canonical.q)
  for (const region of canonical.regions ?? []) params.append('region', region)
  if (canonical.coverage) params.set('coverage', canonical.coverage)
  if (sort !== DEFAULT_TERRITORY_LIST_SORT_KEY || dir !== DEFAULT_TERRITORY_LIST_SORT_DIR) {
    params.set('sort', sort)
    if (dir !== defaultTerritoryListSortDir(sort)) params.set('dir', dir)
  }
  return params
}

export const buildTerritoryListHref = (state: TerritoryListState): string => {
  const query = serializeTerritoryListSearchParams(state).toString()
  return query ? `/campanha/territorios?${query}` : '/campanha/territorios'
}

export const buildTerritorySortHref = createSortToggleHref<
  TerritoryListState,
  TerritoryListSortKey
>({
  resolveCurrentSort: resolveTerritoryListSort,
  defaultDir: defaultTerritoryListSortDir,
  buildHref: buildTerritoryListHref,
})

export const resolveTerritoryListUrl = (
  params: TerritoryListSearchParams,
): { state: TerritoryListState; href: string; redirectHref?: string } => {
  const state = parseTerritoryListParams(params)
  const href = buildTerritoryListHref(state)
  const canonicalQuery = serializeTerritoryListSearchParams(state).toString()
  const raw = inspectRawListParams(params, territoryListParamNameSet)
  return {
    state,
    href,
    ...(raw.hasUnsupportedParams || raw.query !== canonicalQuery ? { redirectHref: href } : {}),
  }
}

const sortOptionLabel = (key: TerritoryListSortKey, dir: TerritoryListSortDirection): string => {
  const label = territoryListSortLabels[key]
  if (key === 'region') return `${label} (${dir === 'asc' ? 'A–Z' : 'Z–A'})`
  return `${label} (${dir === 'asc' ? 'menor → maior' : 'maior → menor'})`
}

export const territoryListSortOptions = territoryListSortKeys.flatMap((key) =>
  (['asc', 'desc'] as const).map((dir) => ({ key, dir, label: sortOptionLabel(key, dir) })),
)
