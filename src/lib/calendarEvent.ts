import { escapeICalText, foldICalLine, formatICalDate } from '@/lib/ical'

/**
 * S29 — pure builders for the calendar options of an announcement link
 * (Google Calendar template URL + downloadable `.ics`). No I/O, no Payload:
 * the page and the route handler only feed the configured event data.
 */

export const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000

export type CalendarEventInput = {
  title: string
  description?: string | null
  location?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

const formatInstant = (date: Date): string => formatICalDate(date.toISOString())

/**
 * The event window: no `startsAt` (or an invalid one) means "no event" — the
 * calendar options hide; an absent/invalid `endsAt` or one that does not move
 * forward falls back to the standard 2-hour duration. Never a broken/empty
 * file: callers get `null` and drop the option entirely.
 */
export const resolveCalendarEventWindow = (
  startsAt?: string | null,
  endsAt?: string | null,
): { start: Date; end: Date } | null => {
  if (!startsAt) return null

  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return null

  const end = endsAt ? new Date(endsAt) : null
  if (!end || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    return { start, end: new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS) }
  }

  return { start, end }
}

/** `https://calendar.google.com/calendar/render?action=TEMPLATE…` or null without a valid start. */
export const buildGoogleCalendarEventUrl = (event: CalendarEventInput): string | null => {
  const window = resolveCalendarEventWindow(event.startsAt, event.endsAt)
  if (!window) return null

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatInstant(window.start)}/${formatInstant(window.end)}`,
  })
  if (event.description) params.set('details', event.description)
  if (event.location) params.set('location', event.location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * A single-event VCALENDAR (CRLF, RFC 5545) for the `.ics` download; null
 * without a valid start so the route can answer 404 instead of an empty file.
 */
export const buildCalendarEventIcs = ({
  uid,
  updatedAt,
  ...event
}: CalendarEventInput & { uid: string; updatedAt?: string | null }): string | null => {
  const window = resolveCalendarEventWindow(event.startsAt, event.endsAt)
  if (!window) return null

  const updated = updatedAt ? new Date(updatedAt) : null
  const dtstamp = !updated || Number.isNaN(updated.getTime()) ? window.start : updated

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Teqo//Link de compartilhamento//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeICalText(uid)}`,
    `DTSTAMP:${formatInstant(dtstamp)}`,
    `DTSTART:${formatInstant(window.start)}`,
    `DTEND:${formatInstant(window.end)}`,
    `SUMMARY:${escapeICalText(event.title)}`,
  ]

  if (event.description) lines.push(`DESCRIPTION:${escapeICalText(event.description)}`)
  if (event.location) lines.push(`LOCATION:${escapeICalText(event.location)}`)

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.map(foldICalLine).join('\r\n')
}
