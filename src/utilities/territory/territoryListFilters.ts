import { truncatedNamesLabel } from '@/utilities/campaignListUrl'
import {
  buildTerritoryListHref,
  parseTerritoryListParams,
  territoryListStateToRawParams,
  type TerritoryCoverage,
  type TerritoryListState,
} from '@/utilities/territory/territoryListUrl'

export type TerritoryFilterParam = 'region' | 'coverage'

export type TerritoryFilterOption = {
  value: string
  label: string
}

export const territoryCoverageLabels = {
  com_assessor: 'Cobertura completa',
  sem_assessor: 'Com lacunas de assessoria',
} as const satisfies Record<TerritoryCoverage, string>

export const territoryCoverageOptions = (
  ['com_assessor', 'sem_assessor'] as const satisfies readonly TerritoryCoverage[]
).map((value) => ({ value, label: territoryCoverageLabels[value] }))

const withTerritoryListPageReset = (state: TerritoryListState): TerritoryListState =>
  parseTerritoryListParams(territoryListStateToRawParams({ ...state, page: 1 }, 1))

export const toggleTerritoryRegionFilter = (
  state: TerritoryListState,
  region: string,
): TerritoryListState => {
  const current = state.regions ?? []
  const regions = current.some((entry) => entry === region)
    ? current.filter((entry) => entry !== region)
    : [...current, region]
  return parseTerritoryListParams({
    ...territoryListStateToRawParams({ ...state, page: 1 }, 1),
    region: regions,
  })
}

export const toggleTerritoryCoverageFilter = (
  state: TerritoryListState,
  coverage: TerritoryCoverage,
): TerritoryListState =>
  withTerritoryListPageReset({
    ...state,
    coverage: state.coverage === coverage ? undefined : coverage,
  })

export const clearTerritoryListFilters = (state: TerritoryListState): TerritoryListState => ({
  page: 1,
  sort: state.sort,
  dir: state.dir,
})

/** Every filter/search change resets pagination — sibling of `buildMunicipalityFilterHref`. */
export const buildTerritoryFilterHref = (next: TerritoryListState): string =>
  buildTerritoryListHref(next, 1)

export const isTerritoryFilterActive = (
  state: TerritoryListState,
  param: TerritoryFilterParam,
): boolean => (param === 'region' ? Boolean(state.regions?.length) : Boolean(state.coverage))

export const formatTerritoryActiveFiltersSummary = (state: TerritoryListState): string | null => {
  const parts: string[] = []
  if (state.regions?.length) parts.push(truncatedNamesLabel(state.regions))
  if (state.coverage) parts.push(territoryCoverageLabels[state.coverage])
  if (state.q) parts.push(`Busca "${state.q}"`)
  return parts.length ? parts.join(' · ') : null
}
