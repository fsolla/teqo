'use client'

import FullCalendar, {
  type CalendarRef,
  type DateClickInfo,
  type DatesSetInfo,
  type EventDisplayInfo,
  type EventDropInfo,
  type EventInput,
  type EventResizeDoneInfo,
} from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import listPlugin from '@fullcalendar/react/list'
import ptBrLocale from '@fullcalendar/react/locales/pt-br'
import '@fullcalendar/react/skeleton.css'
import themePlugin from '@fullcalendar/react/themes/classic'
import '@fullcalendar/react/themes/classic/theme.css'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import { UserRoundCheckIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  loadActivityAgendaEvents,
  rescheduleActivity,
} from '@/app/(campaign)/campanha/actions/activity'
import {
  ActivityInlineCreate,
  type ActivityInlineCreateDraft,
} from '@/components/campaign/activity/ActivityInlineCreate'
import { AgendaPeriodChrome } from '@/components/campaign/activity/AgendaPeriodChrome'
import { useAgendaSwipeNavigation } from '@/components/campaign/activity/useAgendaSwipeNavigation'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { Button } from '@/components/ui/button'
import { useIsMobileMeasured } from '@/hooks/use-mobile'
import { formatBahiaCivilDate } from '@/lib/campaignTime'
import {
  ACTIVITY_RESCHEDULE_FAILED_MESSAGE,
  activityStatusLabels,
  type ActivityStatus,
} from '@/lib/schemas/activity'
import {
  activityAgendaPeriodLabel,
  activityAgendaViewFcId,
  activityAgendaViewFromFcId,
  activitySlotPrefill,
  type ActivityAgendaState,
  type ActivityAgendaView,
} from '@/utilities/activityUi'
import type { ActivityAgendaEvent } from '@/utilities/activityViewModels'

import './ActivityAgenda.css'

type AgendaEventProps = {
  status: ActivityStatus
  deputyPresent: boolean
  municipalityName: string | null
  locality: string | null
  tags: string[]
}

const eventColors: Record<ActivityStatus, { color: string; contrastColor: string }> = {
  confirmado: { color: 'var(--primary)', contrastColor: 'var(--primary-foreground)' },
  realizado: {
    color: 'var(--support-engaged)',
    contrastColor: 'var(--support-engaged-foreground)',
  },
  cancelado: { color: 'var(--muted)', contrastColor: 'var(--muted-foreground)' },
}

const MOBILE_BREAKPOINT_PX = 640

/**
 * C101 — the desktop chrome the FullCalendar toolbar keeps: title + prev/next
 * + today. Mobile replaces it with the app header (period title + swipe).
 */
const desktopToolbarConfig = { start: 'prev,next today', center: 'title' } as const

/** C101 — the fixed scroll anchor the day view opens at ("hoje é fixa em 08:00"). */
const AGENDA_DAY_SCROLL_TIME = '08:00:00'

const toEventInput = (event: ActivityAgendaEvent): EventInput => ({
  id: String(event.id),
  title: event.title,
  start: event.startAt,
  end: event.endAt ?? undefined,
  allDay: false,
  url: event.href,
  startEditable: event.canReschedule,
  durationEditable: event.canReschedule,
  className: `activity-agenda-event activity-agenda-event--${event.status}`,
  ...eventColors[event.status],
  extendedProps: {
    status: event.status,
    deputyPresent: event.deputyPresent,
    municipalityName: event.municipality?.name ?? null,
    locality: event.locality,
    tags: event.tags,
  } satisfies AgendaEventProps,
})

/**
 * C105 — the tag row is a light label, not a badge: tag has no visual
 * identity (the active filter is the highlight). Two tags plus a "+N" cap
 * the row so a dense slot never floods.
 */
export const tagsLabel = (tags: readonly string[]): string | null => {
  if (tags.length === 0) return null
  const shown = tags.slice(0, 2)
  const overflow = tags.length - shown.length
  const label = shown.map((tag) => `#${tag}`).join(' ')
  return overflow > 0 ? `${label} +${overflow}` : label
}

const renderEventContent = ({ event, timeText, view }: EventDisplayInfo) => {
  const props = event.extendedProps as AgendaEventProps
  const location = [props.municipalityName, props.locality].filter(Boolean).join(' · ')
  // The tag row only renders outside the dense month grid.
  const tags = view.type.startsWith('dayGrid') ? null : tagsLabel(props.tags)

  return (
    <div className="activity-agenda-event-content">
      <div className="activity-agenda-event-heading">
        {timeText ? <span className="activity-agenda-event-time">{timeText}</span> : null}
        {props.deputyPresent ? (
          <span className="activity-agenda-deputy" title="Deputado presente">
            <UserRoundCheckIcon aria-hidden="true" />
            <span className="sr-only">Deputado presente</span>
          </span>
        ) : null}
      </div>
      <span className="activity-agenda-event-title">{event.title}</span>
      {location ? <span className="activity-agenda-event-location">{location}</span> : null}
      {tags ? <span className="activity-agenda-event-tags">{tags}</span> : null}
      <span className="activity-agenda-event-status">{activityStatusLabels[props.status]}</span>
    </div>
  )
}

export const ActivityAgenda = ({
  state,
  municipalityOptions = [],
  knownTags,
}: {
  state: ActivityAgendaState
  municipalityOptions?: RelationOption[]
  knownTags?: string[]
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<CalendarRef>(null)
  const narrowRef = useRef<boolean | null>(null)
  const mountedRef = useRef(false)
  const pendingEventIDs = useRef(new Set<string>())
  const draggingEventRef = useRef(false)
  const [visibleRange, setVisibleRange] = useState<{
    start: string
    end: string
    anchorDate: string
    view: ActivityAgendaView
  } | null>(null)
  const [events, setEvents] = useState<EventInput[]>([])
  const [reloadCount, setReloadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [savingCount, setSavingCount] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isNarrow, setIsNarrow] = useState(false)
  const [createDraft, setCreateDraft] = useState<ActivityInlineCreateDraft | null>(null)

  // C101 — the mobile behaviors key on the WINDOW (<768, the app top bar's
  // own `md:hidden` breakpoint), not on the calendar container: a desktop
  // window with a narrow content pane (768–800 with the sidebar open) keeps
  // the desktop chrome. The container-based `isNarrow` keeps deciding the
  // responsive day/week fallback, as before C101.
  const { isMobile } = useIsMobileMeasured()

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const applyResponsiveView = () => {
      const api = calendarRef.current?.getApi()
      if (!api) return
      const isNarrow = container.getBoundingClientRect().width < MOBILE_BREAKPOINT_PX
      const previous = narrowRef.current
      narrowRef.current = isNarrow
      setIsNarrow((current) => (current === isNarrow ? current : isNarrow))
      if (previous !== null && isNarrow === previous) return
      // C95 — an explicit view in the URL wins over the responsive week↔day
      // fallback; without one the narrow default keeps working as before.
      if (state.view) return
      const viewType = api.view.type
      if (isNarrow && viewType === 'timeGridWeek') {
        api.changeView('timeGridDay')
      } else if (!isNarrow && viewType === 'timeGridDay') {
        api.changeView('timeGridWeek')
      }
    }

    applyResponsiveView()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(applyResponsiveView)
    observer.observe(container)
    return () => observer.disconnect()
  }, [state.view])

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    if (state.view) {
      const fcId = activityAgendaViewFcId[state.view]
      if (api.view.type !== fcId) api.changeView(fcId)
      return
    }
    // The URL lost the explicit view (sidebar link, back/forward): return to
    // the responsive default so the calendar never keeps an orphan view (e.g.
    // month) the header selector no longer claims.
    const isNarrow =
      (containerRef.current?.getBoundingClientRect().width ?? 0) < MOBILE_BREAKPOINT_PX
    const fallback = isNarrow ? 'timeGridDay' : 'timeGridWeek'
    if (api.view.type !== fallback) api.changeView(fallback)
  }, [state.view])

  useEffect(() => {
    if (!visibleRange) return

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    setEvents([])

    void loadActivityAgendaEvents({
      ...state,
      rangeStart: visibleRange.start,
      rangeEnd: visibleRange.end,
    })
      .then((loadedEvents) => {
        if (!cancelled) setEvents(loadedEvents.map(toEventInput))
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([])
          setLoadError('Não foi possível carregar esta janela da agenda. Tente novamente.')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadCount, state, visibleRange])

  const handleDatesSet = useCallback(({ startStr, endStr, view }: DatesSetInfo) => {
    const nextView = activityAgendaViewFromFcId(view.type)
    if (!nextView) return
    // The month grid's visible range starts on the leading Sunday of the
    // previous month — the period label anchors on the calendar's current
    // date (the 1st of the displayed month), which is what the title must
    // claim. Civil date (not the ISO instant): the anchor is only the
    // day/month of the label, and instants near midnight Bahia must not
    // churn the range identity.
    const anchorDate = formatBahiaCivilDate(view.calendar.getDate())
    setVisibleRange((current) =>
      current?.start === startStr &&
      current.end === endStr &&
      current.view === nextView &&
      current.anchorDate === anchorDate
        ? current
        : { start: startStr, end: endStr, anchorDate, view: nextView },
    )
  }, [])

  // C101 — the mobile header period context: derived from the range the
  // calendar actually shows (so it follows swipe navigation and view changes),
  // rendered only when the mobile top bar is the visible chrome.
  const periodLabel = useMemo(() => {
    if (!visibleRange) return null
    return activityAgendaPeriodLabel(
      visibleRange.view,
      visibleRange.start,
      visibleRange.end,
      visibleRange.anchorDate,
    )
  }, [visibleRange])

  const handleToday = useCallback(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api.today()
    // C101 rabbit-hole cut: re-center on the way back to today (the day view
    // opens at 08:00), but never fight the user's scroll on day changes.
    api.scrollToTime(AGENDA_DAY_SCROLL_TIME)
  }, [])

  const handleEventDragStart = useCallback(() => {
    draggingEventRef.current = true
  }, [])

  const handleEventDragStop = useCallback(() => {
    draggingEventRef.current = false
  }, [])

  const handleEventResizeStart = useCallback(() => {
    draggingEventRef.current = true
  }, [])

  const handleEventResizeStop = useCallback(() => {
    draggingEventRef.current = false
  }, [])

  const handleSwipeNavigation = useCallback((direction: 'next' | 'prev') => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    if (direction === 'next') api.next()
    else api.prev()
  }, [])

  const { suppressDateClickRef } = useAgendaSwipeNavigation({
    containerRef,
    enabled: isMobile,
    blockRef: draggingEventRef,
    onSwipe: handleSwipeNavigation,
  })

  const handleDateClick = useCallback(
    (info: DateClickInfo) => {
      // C101 — a consumed swipe ends with FullCalendar's dateClick in the day
      // view (single column: the hit never leaves the starting slot). The
      // navigation already happened — swallow the click so it does not open
      // the inline create.
      if (suppressDateClickRef.current) return

      const prefill = activitySlotPrefill(info)
      if (!prefill) return

      const jsEvent = info.jsEvent as MouseEvent | undefined
      const hasPoint = typeof jsEvent?.clientX === 'number' && typeof jsEvent?.clientY === 'number'
      const anchor = hasPoint
        ? { x: (jsEvent as MouseEvent).clientX, y: (jsEvent as MouseEvent).clientY }
        : (() => {
            const rect = containerRef.current?.getBoundingClientRect()
            return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null
          })()

      setCreateDraft({ ...prefill, anchor })
    },
    [suppressDateClickRef],
  )

  const persistSchedule = useCallback(
    async ({
      id,
      startAt,
      endAt,
      revert,
    }: {
      id: string
      startAt: string
      endAt: string | null
      revert: () => void
    }) => {
      if (pendingEventIDs.current.has(id)) {
        revert()
        return
      }

      pendingEventIDs.current.add(id)
      setSavingCount((count) => count + 1)
      try {
        const result = await rescheduleActivity({ id: Number(id), startAt, endAt })
        if (!mountedRef.current) return

        if (!result.ok) {
          revert()
          toast.error(result.message)
          return
        }
        setEvents((current) =>
          current.map((event) =>
            String(event.id) === id ? { ...event, start: startAt, end: endAt ?? undefined } : event,
          ),
        )
        setReloadCount((count) => count + 1)
        toast.success('Horário atualizado.')
      } catch {
        if (!mountedRef.current) return
        revert()
        toast.error(ACTIVITY_RESCHEDULE_FAILED_MESSAGE)
      } finally {
        pendingEventIDs.current.delete(id)
        if (mountedRef.current) setSavingCount((count) => Math.max(0, count - 1))
      }
    },
    [],
  )

  const handleScheduleChange = useCallback(
    (info: EventDropInfo | EventResizeDoneInfo) => {
      void persistSchedule({
        id: info.event.id,
        startAt: info.event.startStr,
        endAt: info.event.endStr || null,
        revert: info.revert,
      })
    },
    [persistSchedule],
  )

  return (
    <section className="activity-agenda-shell" aria-label="Calendário de atividades">
      <div className="sr-only" aria-live="polite">
        {savingCount > 0 ? 'Salvando novo horário…' : null}
        {loadError}
      </div>

      {isLoading ? (
        <div className="activity-agenda-notice" role="status">
          Carregando compromissos…
        </div>
      ) : null}

      {loadError ? (
        <div className="activity-agenda-notice" role="alert">
          <span>{loadError}</span>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setReloadCount((count) => count + 1)}
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <AgendaPeriodChrome label={isMobile ? periodLabel : null} onToday={handleToday} />

      <div className="activity-agenda" aria-busy={isLoading || savingCount > 0} ref={containerRef}>
        <FullCalendar
          ref={calendarRef}
          plugins={[themePlugin, timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
          locale={ptBrLocale}
          timeZone="America/Bahia"
          firstDay={1}
          initialView={state.view ? activityAgendaViewFcId[state.view] : 'timeGridWeek'}
          headerToolbar={isMobile ? false : desktopToolbarConfig}
          height={isMobile ? '100%' : 'auto'}
          scrollTimeReset={!isMobile}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          scrollTime={AGENDA_DAY_SCROLL_TIME}
          nowIndicator
          allDaySlot={false}
          dayMaxEvents
          editable={!isLoading && savingCount === 0}
          eventLongPressDelay={650}
          events={events}
          datesSet={handleDatesSet}
          eventContent={renderEventContent}
          dateClick={handleDateClick}
          eventDrop={handleScheduleChange}
          eventResize={handleScheduleChange}
          eventDragStart={handleEventDragStart}
          eventDragStop={handleEventDragStop}
          eventResizeStart={handleEventResizeStart}
          eventResizeStop={handleEventResizeStop}
          noEventsText="Nenhum compromisso nesta janela"
          headingLevel={2}
        />
      </div>

      <ActivityInlineCreate
        draft={createDraft}
        isNarrow={isNarrow}
        agendaState={state}
        municipalityOptions={municipalityOptions}
        knownTags={knownTags}
        onClose={() => setCreateDraft(null)}
        onCreated={() => {
          setCreateDraft(null)
          setReloadCount((count) => count + 1)
        }}
      />
    </section>
  )
}
