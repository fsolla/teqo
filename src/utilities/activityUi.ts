import type { Where } from 'payload'

import { isContactSearchQueryReady, normalizeContactSearchQuery } from '@/lib/contactSearchQuery'
import { activityStatuses, type ActivityStatus } from '@/lib/schemas/activity'
import {
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams as CampaignListRawSearchParams,
} from '@/utilities/campaignListUrl'

export const activityPageSize = 25

export const activityTabs = ['proximos', 'todos', 'realizados'] as const
export type ActivityTab = (typeof activityTabs)[number]

export { type ActivityStatus }

export const activityTabLabels: Record<ActivityTab, string> = {
  proximos: 'Próximos',
  todos: 'Todos',
  realizados: 'Realizados',
}

export type ActivityListState = {
  page: number
  tab: ActivityTab
  q?: string
  tag?: string
  status?: ActivityStatus
  municipality?: number
}

type RawSearchParams = CampaignListRawSearchParams

const activityListParamNames = ['q', 'tab', 'tag', 'status', 'municipality', 'page'] as const

const activityListParamNameSet = new Set<string>(activityListParamNames)

const isActivityTab = (value: string | undefined): value is ActivityTab =>
  activityTabs.includes(value as ActivityTab)

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
  const rawTag = firstValue(params.tag)
  const tag = rawTag?.trim() ? rawTag.trim() : undefined
  const rawStatus = tab === 'todos' ? firstValue(params.status) : undefined
  const status = isActivityStatus(rawStatus) ? rawStatus : undefined
  const municipality = strictDecimalInteger(firstValue(params.municipality))

  return {
    page: rawPage ?? 1,
    tab,
    ...(q ? { q } : {}),
    ...(tag ? { tag } : {}),
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

  if (state.tag) filters.push({ tags: { contains: state.tag } })
  if (state.municipality) filters.push({ municipality: { equals: state.municipality } })

  if (state.tab === 'proximos') {
    filters.push({ status: { equals: 'confirmado' } })
    filters.push({ startAt: { greater_than_equal: now.toISOString() } })
  } else if (state.tab === 'realizados') {
    filters.push({ status: { equals: 'realizado' } })
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
    tag: state.tag,
    status: state.status,
    municipality: state.municipality === undefined ? undefined : String(state.municipality),
  })
  const params = new URLSearchParams()

  if (canonicalState.q) params.set('q', canonicalState.q)
  if (canonicalState.tab !== 'proximos') params.set('tab', canonicalState.tab)
  if (canonicalState.tag) params.set('tag', canonicalState.tag)
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
