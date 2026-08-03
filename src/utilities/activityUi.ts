import type { Where } from 'payload'

import { isContactSearchQueryReady, normalizeContactSearchQuery } from '@/lib/contactSearchQuery'
import { activityKinds, activityStatuses, type ActivityKind } from '@/lib/schemas/activity'
import {
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams as CampaignListRawSearchParams,
} from '@/utilities/campaignListUrl'

export const activityPageSize = 25

export const activityTabs = ['proximos', 'todos', 'realizados', 'rascunhos'] as const
export type ActivityTab = (typeof activityTabs)[number]

export type ActivityStatus = (typeof activityStatuses)[number]

export const activityTabLabels: Record<ActivityTab, string> = {
  proximos: 'Próximos',
  todos: 'Todos',
  realizados: 'Realizados',
  rascunhos: 'Rascunhos',
}

export type ActivityListState = {
  page: number
  tab: ActivityTab
  q?: string
  kind?: ActivityKind
  status?: ActivityStatus
  municipality?: number
}

type RawSearchParams = CampaignListRawSearchParams

const activityListParamNames = ['q', 'tab', 'kind', 'status', 'municipality', 'page'] as const

const activityListParamNameSet = new Set<string>(activityListParamNames)

const isActivityTab = (value: string | undefined): value is ActivityTab =>
  activityTabs.includes(value as ActivityTab)

const isActivityKind = (value: string | undefined): value is ActivityKind =>
  activityKinds.includes(value as ActivityKind)

const isActivityStatus = (value: string | undefined): value is ActivityStatus =>
  activityStatuses.includes(value as ActivityStatus)

const isActivityListSearchReady = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined
  const { trimmed } = normalizeContactSearchQuery(raw)
  return isContactSearchQueryReady(trimmed) ? trimmed : undefined
}

export const parseActivityListParams = (params: RawSearchParams): ActivityListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = isActivityListSearchReady(normalizedText(firstValue(params.q)))
  const rawTab = firstValue(params.tab)
  const tab = isActivityTab(rawTab) ? rawTab : 'proximos'
  const rawKind = firstValue(params.kind)
  const kind = isActivityKind(rawKind) ? rawKind : undefined
  const rawStatus = tab === 'todos' ? firstValue(params.status) : undefined
  const status = isActivityStatus(rawStatus) ? rawStatus : undefined
  const municipality = strictDecimalInteger(firstValue(params.municipality))

  return {
    page: rawPage ?? 1,
    tab,
    ...(q ? { q } : {}),
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(municipality ? { municipality } : {}),
  }
}

export const buildActivityListWhere = (state: ActivityListState, now: Date): Where => {
  const filters: Where[] = []

  if (state.q) {
    const q = isActivityListSearchReady(state.q)
    if (q) {
      filters.push({
        or: [{ title: { contains: q } }, { 'responsible.name': { contains: q } }],
      })
    }
  }

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

export const buildActivityListSearchParams = (
  state: ActivityListState,
  page = state.page,
): URLSearchParams => {
  const canonicalState = parseActivityListParams({
    page: String(page),
    q: state.q,
    tab: state.tab,
    kind: state.kind,
    status: state.status,
    municipality: state.municipality === undefined ? undefined : String(state.municipality),
  })
  const params = new URLSearchParams()

  if (canonicalState.q) params.set('q', canonicalState.q)
  if (canonicalState.tab !== 'proximos') params.set('tab', canonicalState.tab)
  if (canonicalState.kind) params.set('kind', canonicalState.kind)
  if (canonicalState.status) params.set('status', canonicalState.status)
  if (canonicalState.municipality) params.set('municipality', String(canonicalState.municipality))
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))

  return params
}

export const buildActivityFiltersKey = (state: ActivityListState): string =>
  buildActivityListSearchParams(state).toString()

export const buildActivityListHref = (state: ActivityListState, page: number): string =>
  buildListHref(state, buildActivityListSearchParams, '/campanha/atividades', page)

export const resolveActivityListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): {
  state: ActivityListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: activityListParamNameSet,
    parse: parseActivityListParams,
    buildSearchParams: buildActivityListSearchParams,
    basePath: '/campanha/atividades',
    totalPages,
  })
