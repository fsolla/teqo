import type { Where } from 'payload'

import { allDayStartInstant } from '@/lib/activityAllDay'
import { CAMPAIGN_AGENDA_HOME } from '@/lib/campaignPaths'
import {
  formatBahiaCivilDate,
  parseBahiaDateTimeInput,
  subtractBahiaCivilDays,
} from '@/lib/campaignTime'
import { isContactSearchQueryReady, normalizeContactSearchQuery } from '@/lib/contactSearchQuery'
import {
  activityStatuses,
  MAX_ACTIVITY_TAG_LENGTH,
  MAX_ACTIVITY_TAGS,
  type ActivityStatus,
} from '@/lib/schemas/activity'
import {
  buildListHref,
  firstValue,
  inspectRawListParams,
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

/**
 * C95 — the agenda view modes behind the header selector. Short URL values map
 * to FullCalendar view ids via `activityAgendaViewFcId` (deliberately decoupled
 * from the calendar's internals).
 */
export const activityAgendaViews = ['week', 'day', 'month', 'list'] as const
export type ActivityAgendaView = (typeof activityAgendaViews)[number]

export const activityAgendaViewLabels: Record<ActivityAgendaView, string> = {
  week: 'Semana',
  day: 'Dia',
  month: 'Mês',
  list: 'Lista',
}

export const activityAgendaViewFcId: Record<ActivityAgendaView, string> = {
  week: 'timeGridWeek',
  day: 'timeGridDay',
  month: 'dayGridMonth',
  list: 'listMonth',
}

/**
 * Inverse of `activityAgendaViewFcId`: the FullCalendar view id reported by
 * `datesSet` back to the agenda's own view vocabulary.
 */
export const activityAgendaViewFromFcId = (fcId: string): ActivityAgendaView | null => {
  const match = activityAgendaViews.find((view) => activityAgendaViewFcId[view] === fcId)
  return match ?? null
}

const ptBrMonthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

/**
 * C110 — the period the swipe preview reveals, mirroring FullCalendar's own
 * navigation arithmetic so the preview label (derived from this range via
 * `activityAgendaPeriodLabel`) matches the header title after the commit:
 * day shifts ±1 day, week ±7 days (Bahia has no DST, so instant ± 86.400.000 ms
 * is an exact civil day), month/list shift the anchor (a civil date of the
 * month's 1st) by one month. The month range spans the Monday on or before the
 * 1st through 6 full weeks (42 days — within the agenda's 45-day request cap,
 * which is all the adjacent fetch needs); the label only reads the anchor.
 * Returns null when the range cannot be derived (same fail-closed contract as
 * `activityAgendaPeriodLabel`).
 */
export const activityAgendaAdjacentPeriod = (
  view: ActivityAgendaView,
  range: { start: string; end: string; anchorDate: string },
  direction: 'next' | 'prev',
): { start: string; end: string; anchorDate: string } | null => {
  const shift = direction === 'next' ? 1 : -1

  const shiftRangeByDays = (days: number) => {
    const start = new Date(range.start)
    const end = new Date(range.end)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    const shiftedStart = new Date(start.getTime() + days * 86_400_000)
    return {
      start: shiftedStart.toISOString(),
      end: new Date(end.getTime() + days * 86_400_000).toISOString(),
      anchorDate: formatBahiaCivilDate(shiftedStart),
    }
  }

  if (view === 'day' || view === 'week') {
    return shiftRangeByDays(shift * (view === 'day' ? 1 : 7))
  }

  const anchor = civilDateParts(range.anchorDate)
  if (!anchor || anchor.day !== 1) return null

  const shiftedAnchorParts = shiftCivilMonth(anchor.year, anchor.month, shift)
  const shiftedAnchor = `${shiftedAnchorParts.year}-${pad(shiftedAnchorParts.month)}-01`
  if (view === 'list') {
    const nextMonth = shiftCivilMonth(shiftedAnchorParts.year, shiftedAnchorParts.month, 1)
    return {
      start: allDayStartInstant(shiftedAnchor),
      end: allDayStartInstant(`${nextMonth.year}-${pad(nextMonth.month)}-01`),
      anchorDate: shiftedAnchor,
    }
  }

  // month — the grid starts on the Monday (firstDay=1) on or before the 1st
  // and spans at most 6 weeks.
  const start = subtractBahiaCivilDays(shiftedAnchor, mondayOffsetOf(shiftedAnchor))
  return {
    start: allDayStartInstant(start),
    end: allDayStartInstant(subtractBahiaCivilDays(start, -42)),
    anchorDate: shiftedAnchor,
  }
}

const pad = (value: number): string => String(value).padStart(2, '0')

const shiftCivilMonth = (
  year: number,
  month: number,
  months: number,
): { year: number; month: number } => {
  const absolute = year * 12 + (month - 1) + months
  return { year: Math.floor(absolute / 12), month: (absolute % 12) + 1 }
}

/** Weekday of a civil date counted from Monday (0 = Monday … 6 = Sunday). */
const mondayOffsetOf = (civilDate: string): number => {
  const [year, month, day] = civilDate.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return (weekday + 6) % 7
}

const civilDateParts = (civilDate: string): { year: number; month: number; day: number } | null => {
  const [year, month, day] = civilDate.split('-').map(Number)
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }
  return { year, month, day }
}

const civilDateLabel = (civilDate: string): string | null => {
  const parts = civilDateParts(civilDate)
  if (!parts) return null
  return `${parts.day} ${ptBrMonthNames[parts.month - 1]}`
}

/**
 * C101 — the period context the mobile app header shows while the calendar
 * navigates: day → "9 Agosto"; week → "3–9 Agosto" (visible Mon–Sun, months
 * spelled out when the range crosses one: "28 Julho – 3 Agosto"); month →
 * "Agosto"; list → "Agenda" (the dates live in the list body). The month
 * label uses the view's current date, NOT the grid range start: the month
 * grid's visible range begins on the leading Sunday of the previous month.
 * Returns null when the range cannot be read, so the header falls back to
 * the catalog title instead of inventing a label.
 */
export const activityAgendaPeriodLabel = (
  view: ActivityAgendaView,
  startStr: string,
  endStr: string,
  currentDateStr: string,
): string | null => {
  if (view === 'list') return 'Agenda'

  const civilDateOf = (value: string): string | null => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : formatBahiaCivilDate(date)
  }

  const start = civilDateOf(startStr)
  const end = civilDateOf(endStr)
  const startParts = start ? civilDateParts(start) : null
  const endParts = end ? civilDateParts(end) : null
  if (!start || !end || !startParts || !endParts) return null

  if (view === 'day') return civilDateLabel(start)

  // The anchor is ALREADY a Bahia civil date (`formatBahiaCivilDate` output,
  // no timezone) — parsing it as an instant would re-derive it from UTC
  // midnight and shift it back a day (2026-09-01 → 31 Agosto in Bahia).
  const currentParts = civilDateParts(currentDateStr)
  if (view === 'month') {
    if (!currentParts) return null
    return ptBrMonthNames[currentParts.month - 1]
  }

  const weekEnd = civilDateParts(subtractBahiaCivilDays(end, 1))
  if (!weekEnd) return null
  if (weekEnd.month === startParts.month) {
    return `${startParts.day}–${weekEnd.day} ${ptBrMonthNames[startParts.month - 1]}`
  }
  return `${startParts.day} ${ptBrMonthNames[startParts.month - 1]} – ${weekEnd.day} ${ptBrMonthNames[weekEnd.month - 1]}`
}

const isActivityAgendaView = (value: string | undefined): value is ActivityAgendaView =>
  activityAgendaViews.includes(value as ActivityAgendaView)

export type ActivityAgendaState = {
  municipality?: number
  deputyPresent?: true
  tag?: string
  view?: ActivityAgendaView
}

const activityAgendaParamNames = ['municipality', 'deputyPresent', 'tag', 'view'] as const
const activityAgendaParamNameSet = new Set<string>(activityAgendaParamNames)

const activityTag = (value: string | undefined): string | undefined => {
  const tag = normalizedText(value)
  return tag && tag.length <= MAX_ACTIVITY_TAG_LENGTH ? tag : undefined
}

export const parseActivityAgendaParams = (params: RawSearchParams): ActivityAgendaState => {
  const municipality = strictDecimalInteger(firstValue(params.municipality))
  const deputyPresent = firstValue(params.deputyPresent) === '1' ? true : undefined
  const tag = activityTag(firstValue(params.tag))
  const rawView = firstValue(params.view)
  const view = isActivityAgendaView(rawView) ? rawView : undefined

  return {
    ...(municipality ? { municipality } : {}),
    ...(deputyPresent ? { deputyPresent } : {}),
    ...(tag ? { tag } : {}),
    ...(view ? { view } : {}),
  }
}

export const buildActivityAgendaSearchParams = (state: ActivityAgendaState): URLSearchParams => {
  const canonicalState = parseActivityAgendaParams({
    municipality: state.municipality === undefined ? undefined : String(state.municipality),
    deputyPresent: state.deputyPresent ? '1' : undefined,
    tag: state.tag,
    view: state.view,
  })
  const params = new URLSearchParams()

  if (canonicalState.municipality) {
    params.set('municipality', String(canonicalState.municipality))
  }
  if (canonicalState.deputyPresent) params.set('deputyPresent', '1')
  if (canonicalState.tag) params.set('tag', canonicalState.tag)
  if (canonicalState.view) params.set('view', canonicalState.view)

  return params
}

export const buildActivityAgendaHref = (state: ActivityAgendaState): string => {
  const query = buildActivityAgendaSearchParams(state).toString()
  return query ? `${CAMPAIGN_AGENDA_HOME}?${query}` : CAMPAIGN_AGENDA_HOME
}

export const restrictActivityAgendaState = (
  state: ActivityAgendaState,
  accessibleMunicipalityIDs: ReadonlySet<number>,
  accessibleTags: ReadonlySet<string>,
): ActivityAgendaState => ({
  ...(state.municipality && accessibleMunicipalityIDs.has(state.municipality)
    ? { municipality: state.municipality }
    : {}),
  ...(state.deputyPresent ? { deputyPresent: true } : {}),
  ...(state.tag && accessibleTags.has(state.tag) ? { tag: state.tag } : {}),
  ...(state.view ? { view: state.view } : {}),
})

export const resolveActivityAgendaUrl = (
  params: RawSearchParams,
): {
  state: ActivityAgendaState
  href: string
  redirectHref?: string
} => {
  const state = parseActivityAgendaParams(params)
  const canonicalQuery = buildActivityAgendaSearchParams(state).toString()
  const href = canonicalQuery ? `${CAMPAIGN_AGENDA_HOME}?${canonicalQuery}` : CAMPAIGN_AGENDA_HOME
  const raw = inspectRawListParams(params, activityAgendaParamNameSet)

  return {
    state,
    href,
    ...(raw.hasUnsupportedParams || raw.query !== canonicalQuery ? { redirectHref: href } : {}),
  }
}

export const buildActivityAgendaWhere = (
  state: ActivityAgendaState,
  rangeStart: string,
  rangeEnd: string,
): Where => {
  const filters: Where[] = [
    { startAt: { less_than: rangeEnd } },
    {
      or: [
        { endAt: { greater_than: rangeStart } },
        {
          and: [{ endAt: { exists: false } }, { startAt: { greater_than_equal: rangeStart } }],
        },
      ],
    },
  ]

  if (state.municipality) filters.push({ municipality: { equals: state.municipality } })
  if (state.deputyPresent) filters.push({ deputyPresent: { equals: true } })
  if (state.tag) filters.push({ tags: { contains: state.tag } })

  return { and: filters }
}

export type ActivityCreatePrefill = {
  startAt?: string
  endAt?: string
  municipalityId?: number
  title?: string
  tags?: string[]
  /** C104 — the sheet opened the toggle; startAt/endAt are civil dates. */
  allDay?: boolean
}

export const buildActivityCreateHref = (
  agendaState: ActivityAgendaState,
  prefill: Partial<ActivityCreatePrefill> = {},
): string => {
  const params = new URLSearchParams()
  if (prefill.allDay) {
    params.set('allDay', '1')
    if (prefill.startAt) params.set('startAt', prefill.startAt.slice(0, 10))
    if (prefill.endAt) params.set('endAt', prefill.endAt.slice(0, 10))
  } else {
    if (prefill.startAt) params.set('startAt', prefill.startAt)
    if (prefill.endAt) params.set('endAt', prefill.endAt)
  }
  const municipalityId = prefill.municipalityId ?? agendaState.municipality
  if (municipalityId) params.set('municipality', String(municipalityId))
  if (prefill.title) params.set('title', prefill.title)
  // C105 — repeated `tags` params: a free-form tag may contain a comma, so a
  // comma-joined single value would corrupt the boundary between tags.
  for (const tag of prefill.tags ?? []) params.append('tags', tag)
  params.set('returnTo', buildActivityAgendaHref(agendaState))
  return `/campanha/atividades/nova?${params.toString()}`
}

/**
 * C91 — the inline create overlay prefills the slot the staff clicked. The
 * FullCalendar `dateClick` already snaps the click to a slot boundary, so for
 * the week/day grids the interval is the slot itself (30 min); an all-day
 * click (month grid) falls back to the historical 09:00–10:00 window.
 */
export const activitySlotPrefill = (info: {
  allDay: boolean
  dateStr: string
}): { startAt: string; endAt: string } | null => {
  if (info.allDay) {
    const startAt = parseBahiaDateTimeInput(`${info.dateStr.slice(0, 10)}T09:00`)
    if (!startAt) return null
    return { startAt, endAt: new Date(new Date(startAt).getTime() + 3_600_000).toISOString() }
  }
  const start = new Date(info.dateStr)
  if (Number.isNaN(start.getTime())) return null
  return {
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 1_800_000).toISOString(),
  }
}

export const parseActivityAgendaReturnHref = (
  value: string | string[] | undefined,
  accessibleMunicipalityIDs: ReadonlySet<number>,
  accessibleTags: ReadonlySet<string>,
): string => {
  const raw = firstValue(value)
  if (!raw) return CAMPAIGN_AGENDA_HOME

  const base = new URL('https://campaign.invalid')
  let returnUrl: URL
  try {
    returnUrl = new URL(raw, base)
  } catch {
    return CAMPAIGN_AGENDA_HOME
  }
  if (returnUrl.origin !== base.origin || returnUrl.pathname !== CAMPAIGN_AGENDA_HOME) {
    return CAMPAIGN_AGENDA_HOME
  }

  const state = restrictActivityAgendaState(
    parseActivityAgendaParams({
      municipality: returnUrl.searchParams.get('municipality') ?? undefined,
      deputyPresent: returnUrl.searchParams.get('deputyPresent') ?? undefined,
      tag: returnUrl.searchParams.get('tag') ?? undefined,
      view: returnUrl.searchParams.get('view') ?? undefined,
    }),
    accessibleMunicipalityIDs,
    accessibleTags,
  )
  return buildActivityAgendaHref(state)
}

const isoInstantPattern = /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/

const normalizedIsoInstant = (value: string | undefined): string | undefined => {
  if (!value || !isoInstantPattern.test(value)) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/**
 * C105 — bounded prefill tags: repeated `tags` params, trimmed, deduped,
 * capped at the same limits the create schema enforces. Anything out of bounds
 * is dropped (same drop semantics as the agenda filter's `activityTag`),
 * never rejected — a prefill is a convenience, not a contract.
 */
const parseActivityPrefillTags = (value: string | string[] | undefined): string[] | undefined => {
  if (value === undefined) return undefined
  const tags: string[] = []
  for (const entry of Array.isArray(value) ? value : [value]) {
    if (tags.length >= MAX_ACTIVITY_TAGS) break
    const tag = activityTag(entry)
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  return tags.length > 0 ? tags : undefined
}

export const parseActivityCreatePrefill = (
  params: RawSearchParams,
  accessibleMunicipalityIDs: ReadonlySet<number>,
): ActivityCreatePrefill => {
  const rawAllDay = firstValue(params.allDay)
  const allDay = rawAllDay === '1'
  const startAt = allDay
    ? civilDatePrefillInstant(firstValue(params.startAt))
    : normalizedIsoInstant(firstValue(params.startAt))
  const rawEndAt = firstValue(params.endAt)
  const endAt = allDay
    ? civilDatePrefillInstant(rawEndAt, startAt)
    : startAt && rawEndAt && new Date(rawEndAt) > new Date(startAt)
      ? normalizedIsoInstant(rawEndAt)
      : undefined
  const rawMunicipality = strictDecimalInteger(firstValue(params.municipality))
  const municipalityId =
    rawMunicipality && accessibleMunicipalityIDs.has(rawMunicipality) ? rawMunicipality : undefined

  const title = normalizedText(firstValue(params.title))
  const trimmedTitle = title && title.length <= 160 ? title : undefined
  const tags = parseActivityPrefillTags(params.tags)

  return {
    ...(allDay ? { allDay } : {}),
    ...(startAt ? { startAt } : {}),
    ...(endAt ? { endAt } : {}),
    ...(municipalityId ? { municipalityId } : {}),
    ...(trimmedTitle ? { title: trimmedTitle } : {}),
    ...(tags ? { tags } : {}),
  }
}

const civilDatePrefillInstant = (
  value: string | undefined,
  startAt?: string,
): string | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const instant = allDayStartInstant(value)
  if (startAt && instant < startAt) return undefined
  return instant
}

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
      // C90 — `responsible` is a polymorphic multi-relation; a nested
      // `responsible.name` query is not supported on it, so the list search is
      // title-only (see impl plan).
      filters.push({ title: { contains: q } })
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
