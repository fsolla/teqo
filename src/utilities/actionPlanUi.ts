import type { Where } from 'payload'

import { actionPlanKinds, actionPlanStatuses } from '@/lib/schemas/actionPlan'
import {
  buildListHref,
  firstValue,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams as CampaignListRawSearchParams,
} from '@/utilities/campaignListUrl'

export const actionPlanPageSize = 25

export const actionPlanTabs = ['proximos', 'todos', 'realizados', 'rascunhos'] as const
export type ActionPlanTab = (typeof actionPlanTabs)[number]

type ActionPlanKind = (typeof actionPlanKinds)[number]
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
  municipality?: number
}

type RawSearchParams = CampaignListRawSearchParams

const actionPlanListParamNames = ['tab', 'kind', 'status', 'municipality', 'page'] as const

const actionPlanListParamNameSet = new Set<string>(actionPlanListParamNames)

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
  const municipality = strictDecimalInteger(firstValue(params.municipality))

  return {
    page: rawPage ?? 1,
    tab,
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(municipality ? { municipality } : {}),
  }
}

export const buildActionPlanListWhere = (state: ActionPlanListState, now: Date): Where => {
  const filters: Where[] = []

  if (state.kind) filters.push({ kind: { equals: state.kind } })
  if (state.municipality) filters.push({ municipality: { equals: state.municipality } })

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
    municipality: state.municipality === undefined ? undefined : String(state.municipality),
  })
  const params = new URLSearchParams()

  if (canonicalState.tab !== 'proximos') params.set('tab', canonicalState.tab)
  if (canonicalState.kind) params.set('kind', canonicalState.kind)
  if (canonicalState.status) params.set('status', canonicalState.status)
  if (canonicalState.municipality) params.set('municipality', String(canonicalState.municipality))
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))

  return params
}

export const buildActionPlanFiltersKey = (state: ActionPlanListState): string =>
  buildActionPlanListSearchParams(state).toString()

export const buildActionPlanListHref = (state: ActionPlanListState, page: number): string =>
  buildListHref(state, buildActionPlanListSearchParams, '/campanha/planos', page)

export const resolveActionPlanListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): {
  state: ActionPlanListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: actionPlanListParamNameSet,
    parse: parseActionPlanListParams,
    buildSearchParams: buildActionPlanListSearchParams,
    basePath: '/campanha/planos',
    totalPages,
  })
