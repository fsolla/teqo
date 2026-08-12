/**
 * C114 — pure mapping between campaign activities and Google Calendar events.
 *
 * The Google event id is DETERMINISTIC (`teqo` + base32hex of the activity
 * id): Google ids only allow base32hex characters (lowercase a–v, digits 0–9)
 * — no underscores, no uppercase — and the deterministic id makes the whole
 * reconciliation stateless (upsert by id, content-compare to decide updates).
 * Teqo stays the single source of truth; canceled activities are excluded by
 * the engine (their Google event is deleted), never rendered in Google.
 *
 * This module is pure and client-safe; only the engine/client in
 * `src/utilities/googleCalendarSync.ts` touches the network.
 */
import type { Activity } from '@/payload-types'

import { allDayCivilDateOf, allDayExclusiveEndDate } from '@/lib/activityAllDay'
import { buildActivityDescriptionParts } from '@/lib/activityDescription'

const GOOGLE_EVENT_ID_PREFIX = 'teqo'

/** RFC 2938 base32hex alphabet (0–9, a–v) — the only charset Google event ids accept. */
const BASE32HEX_ALPHABET = '0123456789abcdefghijklmnopqrstuv'

/**
 * Brazil standard time is fixed UTC−03:00 (no DST since 2019), so the offset
 * is a constant — the same invariant `campaignTime` builds on.
 */
const BAHIA_FIXED_OFFSET_HOURS = -3
const BAHIA_FIXED_OFFSET_SUFFIX = '-03:00'

/**
 * Google requires `end` strictly after `start` on timed events; an activity
 * without `endAt` (a point-in-time commitment) becomes a 1-hour event — the
 * iCal feed mirrors this as DTEND = DTSTART, which Google cannot represent.
 */
const DEFAULT_TIMED_EVENT_DURATION_MINUTES = 60

export const googleEventIdForActivity = (activityId: number): string => {
  if (!Number.isInteger(activityId) || activityId < 0) {
    throw new Error('ID de atividade inválido para evento do Google.')
  }

  let remainder = activityId
  let encoded = ''
  do {
    encoded = BASE32HEX_ALPHABET[remainder % 32] + encoded
    remainder = Math.floor(remainder / 32)
  } while (remainder > 0)

  return `${GOOGLE_EVENT_ID_PREFIX}${encoded}`
}

/** Inverse of `googleEventIdForActivity` — null for foreign/invalid ids. */
export const decodeGoogleEventActivityId = (eventId: string): number | null => {
  if (!eventId.startsWith(GOOGLE_EVENT_ID_PREFIX)) return null
  const encoded = eventId.slice(GOOGLE_EVENT_ID_PREFIX.length)
  if (encoded.length === 0) return null

  let value = 0
  for (const char of encoded) {
    const digit = BASE32HEX_ALPHABET.indexOf(char)
    if (digit === -1) return null
    value = value * 32 + digit
    if (!Number.isSafeInteger(value)) return null
  }
  return value
}

/**
 * UTC ISO instant → RFC 3339 dateTime in Bahia wall time with the fixed
 * −03:00 offset (what the Calendar API expects; the timeZone field stays
 * unnecessary because the offset is explicit).
 */
const formatBahiaOffsetDateTime = (iso: string): string => {
  const shifted = new Date(new Date(iso).getTime() + BAHIA_FIXED_OFFSET_HOURS * 3_600_000)
  const parts = shifted.toISOString().slice(0, 19).split('T')
  const [date, time] = parts
  const [year, month, day] = date.split('-')
  const [hour, minute, second] = time.split(':')
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${BAHIA_FIXED_OFFSET_SUFFIX}`
}

const addMinutes = (iso: string, minutes: number): string =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()

export const activityMunicipalityIdOf = (
  municipality: Activity['municipality'],
): number | undefined => (typeof municipality === 'number' ? municipality : municipality?.id)

export type GoogleCalendarEventPayload = {
  id: string
  summary: string
  description: string
  location?: string
  start: { dateTime: string } | { date: string }
  end: { dateTime: string } | { date: string }
}

/**
 * Event description without unnecessary PII: municipality, locality, tags and
 * the deputy flag — the same parts the iCal feed renders, joined with real
 * newlines for Google. No leadership names, no phones, no emails.
 */
export const buildGoogleCalendarDescription = (
  activity: Pick<Activity, 'locality' | 'tags' | 'deputyPresent'>,
  municipalityName?: string,
): string => buildActivityDescriptionParts(activity, municipalityName).join('\n')

export const buildGoogleEventPayload = (
  activity: Pick<
    Activity,
    'id' | 'title' | 'startAt' | 'endAt' | 'allDay' | 'locality' | 'tags' | 'deputyPresent'
  >,
  municipalityName?: string,
): GoogleCalendarEventPayload => {
  // C14 guarantees startAt beyond draft; a null start has no Google shape —
  // fail loudly in the mapping (the engine never feeds one: the window query
  // only returns dated activities).
  if (!activity.startAt) {
    throw new Error('Atividade sem data de início não pode virar evento do Google.')
  }

  const summary = municipalityName ? `[${municipalityName}] ${activity.title}` : activity.title
  const description = buildGoogleCalendarDescription(activity, municipalityName)

  const allDay = Boolean(activity.allDay)
  const start = allDay
    ? { date: allDayCivilDateOf(activity.startAt) }
    : { dateTime: formatBahiaOffsetDateTime(activity.startAt) }
  const end = allDay
    ? { date: allDayExclusiveEndDate(activity.endAt ?? activity.startAt) }
    : {
        dateTime: formatBahiaOffsetDateTime(
          activity.endAt ?? addMinutes(activity.startAt, DEFAULT_TIMED_EVENT_DURATION_MINUTES),
        ),
      }

  const locality = activity.locality?.trim()
  const location = locality || municipalityName || undefined

  return {
    id: googleEventIdForActivity(activity.id),
    summary,
    description,
    ...(location ? { location } : {}),
    start,
    end,
  }
}

/** The remote shape the Calendar API echoes on list/insert — a narrow view of it. */
export type GoogleRemoteEvent = {
  id?: string
  summary?: string
  description?: string
  location?: string
  status?: string
  updated?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
}

/** Google's own event lifecycle status — `cancelled` is the trash signal. */
export const GOOGLE_EVENT_STATUS_CANCELLED = 'cancelled'

const startEndInstantEquals = (
  remote: { dateTime?: string; date?: string } | undefined,
  wanted: GoogleCalendarEventPayload['start'],
): boolean => {
  if (!remote) return false
  if ('dateTime' in wanted) {
    // Compare absolute instants: the calendar's own timezone may echo the
    // dateTime with a different offset — the instant is what we control.
    const remoteMs = Date.parse(remote.dateTime ?? '')
    const wantedMs = Date.parse(wanted.dateTime)
    return !Number.isNaN(remoteMs) && !Number.isNaN(wantedMs) && remoteMs === wantedMs
  }
  return remote.date === wanted.date
}

/**
 * Same instant comparison, exported for the engine's editable-fields check
 * (C115 reverse direction) — single implementation of the compare.
 */
export { startEndInstantEquals as googleStartEndInstantEquals }

/**
 * True when the remote event already carries exactly what we would write —
 * the decision rule that makes repeated reconciliation passes converge
 * without touching Google (no update churn, no modified-date spam).
 */
export const googleEventContentEquals = (
  remote: GoogleRemoteEvent,
  payload: GoogleCalendarEventPayload,
): boolean =>
  (remote.summary ?? '') === payload.summary &&
  (remote.description ?? '') === payload.description &&
  (remote.location ?? '') === (payload.location ?? '') &&
  startEndInstantEquals(remote.start, payload.start) &&
  startEndInstantEquals(remote.end, payload.end)
