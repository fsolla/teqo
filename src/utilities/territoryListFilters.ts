import {
  parseTerritoryListParams,
  territoryListStateToRawParams,
  type TerritoryCoverage,
  type TerritoryListState,
} from '@/utilities/territoryListUrl'

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

export const toggleTerritoryRegionFilter = (
  state: TerritoryListState,
  region: string,
): TerritoryListState => {
  const current = state.regions ?? []
  const regions = current.some((entry) => entry === region)
    ? current.filter((entry) => entry !== region)
    : [...current, region]
  return parseTerritoryListParams({
    ...territoryListStateToRawParams(state),
    region: regions,
  })
}

export const toggleTerritoryCoverageFilter = (
  state: TerritoryListState,
  coverage: TerritoryCoverage,
): TerritoryListState =>
  parseTerritoryListParams({
    ...territoryListStateToRawParams(state),
    coverage: state.coverage === coverage ? undefined : coverage,
  })

export const clearTerritoryListFilters = (state: TerritoryListState): TerritoryListState => ({
  sort: state.sort,
  dir: state.dir,
})

export const isTerritoryFilterActive = (
  state: TerritoryListState,
  param: TerritoryFilterParam,
): boolean => (param === 'region' ? Boolean(state.regions?.length) : Boolean(state.coverage))

const firstTerritoryNamesLabel = (names: readonly string[]): string =>
  names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`

export const formatTerritoryActiveFiltersSummary = (state: TerritoryListState): string | null => {
  const parts: string[] = []
  if (state.regions?.length) parts.push(firstTerritoryNamesLabel(state.regions))
  if (state.coverage) parts.push(territoryCoverageLabels[state.coverage])
  if (state.q) parts.push(`Busca "${state.q}"`)
  return parts.length ? parts.join(' · ') : null
}
