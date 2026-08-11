'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import {
  civilDateDaysBetween,
  formatBahiaCivilDate,
  formatIsoAsBahiaDateTimeInput,
} from '@/lib/campaignTime'
import { activityAgendaPeriodLabel, type ActivityAgendaView } from '@/utilities/activityUi'
import type { ActivityAgendaEvent } from '@/utilities/activityViewModels'

/**
 * C110 — the adjacent-period reveal: while the finger drags the grid, this
 * panel sits glued to the seam (a child of the transformed container, at
 * `left: 100%` for next / `right: 100%` for prev) and its edge slides into
 * the revealed strip. It shows the direction chevron, the adjacent period
 * label and an abstract grid frame (the "quadro do grid" of the accept —
 * deliberately NOT a second FullCalendar, which is a cut rabbit hole), with
 * the adjacent period's events entering as bars/dots/rows as they load
 * asynchronously. `aria-hidden`: the gesture is the interaction; the commit
 * replaces the whole preview with the real grid.
 */
const SLOT_START_MINUTES = 7 * 60
const SLOT_END_MINUTES = 22 * 60
const SLOT_SPAN_MINUTES = SLOT_END_MINUTES - SLOT_START_MINUTES
const MAX_PREVIEW_EVENTS = 6

const weekInitials = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const

export type ActivityAgendaAdjacentRange = {
  start: string
  end: string
  anchorDate: string
}

const timedTopPercent = (startAt: string): number => {
  const civil = formatIsoAsBahiaDateTimeInput(startAt)
  const match = /T(\d{2}):(\d{2})/.exec(civil)
  if (!match) return 0
  const minutes = Number(match[1]) * 60 + Number(match[2])
  const clamped = Math.min(Math.max(minutes - SLOT_START_MINUTES, 0), SLOT_SPAN_MINUTES)
  return (clamped / SLOT_SPAN_MINUTES) * 100
}

const monthCellPosition = (
  rangeStart: string,
  startAt: string,
): { column: number; row: number } | null => {
  const startCivil = formatBahiaCivilDate(new Date(rangeStart))
  const eventCivil = formatBahiaCivilDate(new Date(startAt))
  const dayIndex = civilDateDaysBetween(startCivil, eventCivil)
  if (dayIndex < 0 || dayIndex > 41) return null
  return { column: dayIndex % 7, row: Math.floor(dayIndex / 7) }
}

export const ActivityAgendaSwipePreview = ({
  view,
  direction,
  range,
  events,
}: {
  view: ActivityAgendaView
  direction: 'next' | 'prev'
  range: ActivityAgendaAdjacentRange
  events: ActivityAgendaEvent[]
}) => {
  const label = activityAgendaPeriodLabel(view, range.start, range.end, range.anchorDate)
  const seam =
    direction === 'next'
      ? 'activity-agenda-swipe-preview--next'
      : 'activity-agenda-swipe-preview--prev'
  const visibleEvents = events.slice(0, MAX_PREVIEW_EVENTS)

  return (
    <div className={`activity-agenda-swipe-preview ${seam}`} aria-hidden="true">
      <div className="activity-agenda-swipe-preview-content">
        {direction === 'next' ? (
          <ChevronRight className="activity-agenda-swipe-chevron" aria-hidden="true" />
        ) : (
          <ChevronLeft className="activity-agenda-swipe-chevron" aria-hidden="true" />
        )}
        {label ? <span className="activity-agenda-swipe-label">{label}</span> : null}

        {/* C110+ — the positioned indicators (dots/bars) anchor to the frame's
            own box: they live in the same `.activity-agenda-swipe-scene`
            wrapper as the skeleton, so their percentages resolve against the
            frame, not the whole content block (chevron/label included). The
            list view has no frame, so its rows stay in the content flow. */}
        {view !== 'list' ? (
          <div className="activity-agenda-swipe-scene">
            <div className="activity-agenda-swipe-frame" data-view={view}>
              {view === 'week' ? (
                <div className="activity-agenda-swipe-frame-head">
                  {weekInitials.map((initial) => (
                    <span key={initial}>{initial}</span>
                  ))}
                </div>
              ) : null}
            </div>
            {visibleEvents.map((event) => {
              if (view === 'month') {
                const cell = monthCellPosition(range.start, event.startAt)
                if (!cell) return null
                return (
                  <span
                    key={event.id}
                    className="activity-agenda-swipe-dot"
                    style={{
                      left: `${cell.column * (100 / 7)}%`,
                      top: `${cell.row * (100 / 6)}%`,
                    }}
                  />
                )
              }
              return (
                <span
                  key={event.id}
                  className="activity-agenda-swipe-event"
                  style={
                    event.allDay ? { top: '2%' } : { top: `${timedTopPercent(event.startAt)}%` }
                  }
                />
              )
            })}
          </div>
        ) : (
          visibleEvents.map((event) => (
            <span key={event.id} className="activity-agenda-swipe-list-row">
              {event.title}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
