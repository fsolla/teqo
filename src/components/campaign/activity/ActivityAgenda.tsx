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
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  loadActivityAgendaEvents,
  rescheduleActivity,
} from '@/app/(campaign)/campanha/actions/activity'
import {
  ActivityInlineCreate,
  type ActivityInlineCreateDraft,
} from '@/components/campaign/activity/ActivityInlineCreate'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { Button } from '@/components/ui/button'
import {
  ACTIVITY_RESCHEDULE_FAILED_MESSAGE,
  activityStatusLabels,
  type ActivityStatus,
} from '@/lib/schemas/activity'
import { activitySlotPrefill, type ActivityAgendaState } from '@/utilities/activityUi'
import type { ActivityAgendaEvent } from '@/utilities/activityViewModels'

import './ActivityAgenda.css'

type AgendaEventProps = {
  status: ActivityStatus
  deputyPresent: boolean
  municipalityName: string | null
  locality: string | null
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
  } satisfies AgendaEventProps,
})

const renderEventContent = ({ event, timeText }: EventDisplayInfo) => {
  const props = event.extendedProps as AgendaEventProps
  const location = [props.municipalityName, props.locality].filter(Boolean).join(' · ')

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
      <span className="activity-agenda-event-status">{activityStatusLabels[props.status]}</span>
    </div>
  )
}

export const ActivityAgenda = ({
  state,
  municipalityOptions = [],
}: {
  state: ActivityAgendaState
  municipalityOptions?: RelationOption[]
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<CalendarRef>(null)
  const narrowRef = useRef<boolean | null>(null)
  const mountedRef = useRef(false)
  const pendingEventIDs = useRef(new Set<string>())
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string } | null>(null)
  const [events, setEvents] = useState<EventInput[]>([])
  const [reloadCount, setReloadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [savingCount, setSavingCount] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isNarrow, setIsNarrow] = useState(false)
  const [createDraft, setCreateDraft] = useState<ActivityInlineCreateDraft | null>(null)

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
  }, [])

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

  const handleDatesSet = useCallback(({ startStr, endStr }: DatesSetInfo) => {
    setVisibleRange((current) =>
      current?.start === startStr && current.end === endStr
        ? current
        : { start: startStr, end: endStr },
    )
  }, [])

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

  const handleDateClick = useCallback((info: DateClickInfo) => {
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
  }, [])

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

      <div className="activity-agenda" aria-busy={isLoading || savingCount > 0} ref={containerRef}>
        <FullCalendar
          ref={calendarRef}
          plugins={[themePlugin, timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
          locale={ptBrLocale}
          timeZone="America/Bahia"
          firstDay={1}
          initialView="timeGridWeek"
          headerToolbar={{
            start: 'prev,next today',
            center: 'title',
            end: 'timeGridWeek,timeGridDay,dayGridMonth,listMonth',
          }}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          scrollTime="08:00:00"
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
          noEventsText="Nenhum compromisso nesta janela"
          headingLevel={2}
        />
      </div>

      <ActivityInlineCreate
        draft={createDraft}
        isNarrow={isNarrow}
        agendaState={state}
        municipalityOptions={municipalityOptions}
        onClose={() => setCreateDraft(null)}
        onCreated={() => {
          setCreateDraft(null)
          setReloadCount((count) => count + 1)
        }}
      />
    </section>
  )
}
