import type { Where } from 'payload'

import {
  bahiaIdentityTerritories,
  bahiaMunicipalities,
  type BahiaIdentityTerritory,
  territoryForCity,
} from '@/lib/bahiaTerritories'
import { actionPlanKinds, actionPlanStatuses } from '@/lib/schemas/actionPlan'
import { normalizeSearchPhrase } from '@/utilities/wordStartFilter'

export const actionPlanPageSize = 25

export const actionPlanTabs = ['proximos', 'todos', 'realizados', 'rascunhos'] as const
export type ActionPlanTab = (typeof actionPlanTabs)[number]

export type ActionPlanKind = (typeof actionPlanKinds)[number]
export type ActionPlanStatus = (typeof actionPlanStatuses)[number]

export const actionPlanTabLabels: Record<ActionPlanTab, string> = {
  proximos: 'Próximos',
  todos: 'Todos',
  realizados: 'Realizados',
  rascunhos: 'Rascunhos',
}

export type ActionPlanListState = {
  page: number
  tab: ActionPlanTab
  kind?: ActionPlanKind
  status?: ActionPlanStatus
  region?: BahiaIdentityTerritory
  city?: string
}

type RawSearchParams = Record<string, string | string[] | undefined>

export const actionPlanListParamNames = ['tab', 'kind', 'status', 'region', 'city', 'page'] as const

const actionPlanListParamNameSet = new Set<string>(actionPlanListParamNames)

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const normalizedText = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized || undefined
}

const strictDecimalInteger = (value: string | undefined): number | undefined => {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

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

const isActionPlanTab = (value: string | undefined): value is ActionPlanTab =>
  actionPlanTabs.includes(value as ActionPlanTab)

const isActionPlanKind = (value: string | undefined): value is ActionPlanKind =>
  actionPlanKinds.includes(value as ActionPlanKind)

const isActionPlanStatus = (value: string | undefined): value is ActionPlanStatus =>
  actionPlanStatuses.includes(value as ActionPlanStatus)

export const parseActionPlanListParams = (params: RawSearchParams): ActionPlanListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const rawTab = firstValue(params.tab)
  const tab = isActionPlanTab(rawTab) ? rawTab : 'proximos'
  const rawKind = firstValue(params.kind)
  const kind = isActionPlanKind(rawKind) ? rawKind : undefined
  const rawStatus = tab === 'todos' ? firstValue(params.status) : undefined
  const status = isActionPlanStatus(rawStatus) ? rawStatus : undefined
  const region = canonicalOfficialValue(firstValue(params.region), canonicalTerritoryBySearchValue)
  const canonicalCity = canonicalOfficialValue(
    firstValue(params.city),
    canonicalMunicipalityBySearchValue,
  )
  const city =
    canonicalCity && (!region || territoryForCity(canonicalCity) === region)
      ? canonicalCity
      : undefined

  return {
    page: rawPage ?? 1,
    tab,
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(region ? { region } : {}),
    ...(city ? { city } : {}),
  }
}

export const buildActionPlanListWhere = (state: ActionPlanListState, now: Date): Where => {
  const filters: Where[] = []

  if (state.kind) filters.push({ kind: { equals: state.kind } })
  if (state.region) filters.push({ regions: { equals: state.region } })
  if (state.city) filters.push({ cities: { equals: state.city } })

  if (state.tab === 'proximos') {
    filters.push({ status: { in: ['planejado', 'confirmado'] } })
    filters.push({ startAt: { greater_than_equal: now.toISOString() } })
  } else if (state.tab === 'realizados') {
    filters.push({ status: { equals: 'realizado' } })
  } else if (state.tab === 'rascunhos') {
    filters.push({ status: { equals: 'rascunho' } })
  } else if (state.status) {
    filters.push({ status: { equals: state.status } })
  }

  return filters.length ? { and: filters } : {}
}

export const buildActionPlanListSearchParams = (
  state: ActionPlanListState,
  page = state.page,
): URLSearchParams => {
  const canonicalState = parseActionPlanListParams({
    page: String(page),
    tab: state.tab,
    kind: state.kind,
    status: state.status,
    region: state.region,
    city: state.city,
  })
  const params = new URLSearchParams()

  if (canonicalState.tab !== 'proximos') params.set('tab', canonicalState.tab)
  if (canonicalState.kind) params.set('kind', canonicalState.kind)
  if (canonicalState.status) params.set('status', canonicalState.status)
  if (canonicalState.region) params.set('region', canonicalState.region)
  if (canonicalState.city) params.set('city', canonicalState.city)
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))

  return params
}

export const buildActionPlanFiltersKey = (state: ActionPlanListState): string =>
  buildActionPlanListSearchParams(state).toString()

export const buildActionPlanListHref = (state: ActionPlanListState, page: number): string => {
  const params = buildActionPlanListSearchParams(state, page)
  const query = params.toString()
  return query ? `/campanha/planos?${query}` : '/campanha/planos'
}

const inspectRawActionPlanListParams = (
  params: RawSearchParams,
): { hasUnsupportedParams: boolean; query: string } => {
  const serialized = new URLSearchParams()
  let hasUnsupportedParams = false

  for (const [name, value] of Object.entries(params)) {
    if (!actionPlanListParamNameSet.has(name)) {
      hasUnsupportedParams = true
      continue
    }
    if (value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) {
      serialized.append(name, item)
    }
  }

  return { hasUnsupportedParams, query: serialized.toString() }
}

export const resolveActionPlanListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): {
  state: ActionPlanListState
  href: string
  redirectHref?: string
} => {
  const parsedState = parseActionPlanListParams(params)
  const page =
    totalPages !== undefined && totalPages > 0 && parsedState.page > totalPages
      ? totalPages
      : parsedState.page
  const state = page === parsedState.page ? parsedState : { ...parsedState, page }
  const canonicalParams = buildActionPlanListSearchParams(state)
  const canonicalQuery = canonicalParams.toString()
  const href = canonicalQuery ? `/campanha/planos?${canonicalQuery}` : '/campanha/planos'
  const raw = inspectRawActionPlanListParams(params)
  const needsRedirect = raw.hasUnsupportedParams || raw.query !== canonicalQuery

  return {
    state,
    href,
    ...(needsRedirect ? { redirectHref: href } : {}),
  }
}
