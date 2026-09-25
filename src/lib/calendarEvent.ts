import { BAHIA_TIME_ZONE, formatBahiaCalendarDateTime } from '@/lib/campaignTime'
import { escapeICalText, foldICalLine, formatICalDate } from '@/lib/ical'
import { normalizeAbsoluteHttpUrl } from '@/lib/shareLink'

/**
 * S29 — pure builders for the calendar options of an announcement link
 * (Google Calendar template URL + downloadable `.ics`). No I/O, no Payload:
 * the page and the route handler only feed the configured event data.
 */

export const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000
const EVENT_TITLE_SUFFIX = ' - Jorge Solla 1313'

export type CalendarEventInput = {
  title: string
  description?: string | null
  location?: string | null
  url?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

const formatInstant = (date: Date): string => formatICalDate(date.toISOString())
const formatCalendarInstant = (date: Date): string => formatBahiaCalendarDateTime(date)

const resolveEventUrl = (url: string | null | undefined): string | null =>
  normalizeAbsoluteHttpUrl(url)

const resolveCalendarEventContent = (event: CalendarEventInput) => {
  const title = event.title.trim()
  const url = resolveEventUrl(event.url)
  const descriptionParts: string[] = []
  const configuredDescription = event.description

  if (configuredDescription?.trim()) descriptionParts.push(configuredDescription)
  if (url) descriptionParts.push(`Página do evento: ${url}`)

  return {
    title: title.endsWith(EVENT_TITLE_SUFFIX) ? title : `${title}${EVENT_TITLE_SUFFIX}`,
    description: descriptionParts.length > 0 ? descriptionParts.join('\n\n') : null,
    url,
  }
}

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

  const content = resolveCalendarEventContent(event)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: content.title,
    dates: `${formatCalendarInstant(window.start)}/${formatCalendarInstant(window.end)}`,
    ctz: BAHIA_TIME_ZONE,
  })
  if (content.description) params.set('details', content.description)
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

  const content = resolveCalendarEventContent(event)
  const updated = updatedAt ? new Date(updatedAt) : null
  const dtstamp = !updated || Number.isNaN(updated.getTime()) ? window.start : updated

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Teqo//Link de compartilhamento//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${BAHIA_TIME_ZONE}`,
    `X-LIC-LOCATION:${BAHIA_TIME_ZONE}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:-03',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${escapeICalText(uid)}`,
    `DTSTAMP:${formatInstant(dtstamp)}`,
    `DTSTART;TZID=${BAHIA_TIME_ZONE}:${formatCalendarInstant(window.start)}`,
    `DTEND;TZID=${BAHIA_TIME_ZONE}:${formatCalendarInstant(window.end)}`,
    `SUMMARY:${escapeICalText(content.title)}`,
  ]

  if (content.description) lines.push(`DESCRIPTION:${escapeICalText(content.description)}`)
  if (content.url) lines.push(`URL:${content.url}`)
  if (event.location) lines.push(`LOCATION:${escapeICalText(event.location)}`)

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.map(foldICalLine).join('\r\n')
}
