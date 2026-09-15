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

import {
  allDayCivilDateOf,
  allDayEndInstantFromExclusive,
  allDayExclusiveEndDate,
  allDayStartInstant,
  isCivilDate,
} from '@/lib/activityAllDay'
import { buildActivityDescriptionParts } from '@/lib/activityDescription'
import { formatBahiaCivilDate, formatIsoAsBahiaDateTimeInput } from '@/lib/campaignTime'
import { slugify } from '@/lib/slug'
import { CALENDAR_PHASE_ANCHORS } from '@/lib/visitPlannerAnchors'

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

const buildGoogleEventSchedule = (
  activity: Pick<Activity, 'startAt' | 'endAt' | 'allDay'>,
): { start: GoogleCalendarEventPayload['start']; end: GoogleCalendarEventPayload['end'] } => {
  // C14 guarantees startAt beyond draft; a null start has no Google shape —
  // fail loudly in the mapping (the engine never feeds one: the window query
  // only returns dated activities).
  if (!activity.startAt) {
    throw new Error('Atividade sem data de início não pode virar evento do Google.')
  }

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
  return { start, end }
}

export const buildGoogleEventPayload = (
  activity: Pick<
    Activity,
    'id' | 'title' | 'startAt' | 'endAt' | 'allDay' | 'locality' | 'tags' | 'deputyPresent'
  >,
  municipalityName?: string,
): GoogleCalendarEventPayload => {
  const summary = municipalityName ? `[${municipalityName}] ${activity.title}` : activity.title
  const description = buildGoogleCalendarDescription(activity, municipalityName)

  const { start, end } = buildGoogleEventSchedule(activity)

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

/** Matches the `title` field cap in the Activity collection — the same bound the Teqo form enforces. */
const ACTIVITY_TITLE_MAX_LENGTH = 160

/**
 * The summary carries a `[Município] ` prefix we wrote; the user edits what
 * follows it. Only OUR OWN prefix is stripped (matched against the activity's
 * municipality name); anything else is the user's title verbatim — and the
 * forward direction re-prefixes it consistently. A summary that is ONLY the
 * prefix is structural tampering → null → the Teqo re-asserts.
 */
export const googleTitleFromSummary = (
  summary: string | undefined,
  municipalityName?: string,
): string | null => {
  const raw = summary?.trim()
  if (!raw) return null
  const stripped =
    municipalityName && raw.startsWith(`[${municipalityName}]`)
      ? raw.slice(municipalityName.length + 2).trim()
      : raw
  if (!stripped) return null
  return stripped.length > ACTIVITY_TITLE_MAX_LENGTH
    ? stripped.slice(0, ACTIVITY_TITLE_MAX_LENGTH)
    : stripped
}

const parseInstant = (value: string | undefined): string | null => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/**
 * Event start/end → activity schedule. `date` (all-day) maps through the
 * `activityAllDay` conventions; `dateTime` (timed) maps by absolute instant.
 * Malformed values (missing end, exclusive end not after start, unparseable)
 * → null: the Teqo keeps its state and the forward direction re-asserts
 * (fail-safe — a bad Google value never corrupts the activity).
 */
export const googleScheduleToActivityFields = (
  event: Pick<GoogleRemoteEvent, 'start' | 'end'>,
): { startAt: string | null; endAt: string | null; allDay: boolean } | null => {
  const start = event.start
  if (!start) return null

  if (start.date) {
    if (!isCivilDate(start.date)) return null
    const startAt = allDayStartInstant(start.date)
    let endAt = startAt
    if (event.end?.date) {
      if (!isCivilDate(event.end.date) || event.end.date <= start.date) return null
      endAt = allDayEndInstantFromExclusive(event.end.date)
    }
    return { startAt, endAt, allDay: true }
  }

  if (start.dateTime) {
    const startAt = parseInstant(start.dateTime)
    if (!startAt || !event.end?.dateTime) return null
    const endAt = parseInstant(event.end.dateTime)
    if (!endAt) return null
    return { startAt, endAt, allDay: false }
  }

  return null
}

/**
 * C165 — fire only for events the mirror does NOT own: the full deterministic
 * id decode is null. A manual `teqo3`-looking id decodes (non-null) and stays
 * in the mirror namespace — never imported.
 */
export const isForeignGoogleEvent = (event: GoogleRemoteEvent): boolean => {
  const id = event.id
  return typeof id === 'string' && id.length > 0 && decodeGoogleEventActivityId(id) === null
}

/** C165 — the import window mirrors the push window (90d/365d) with the cut as its floor. */
export type GoogleEventImportWindow = { rangeStart: string; rangeEnd: string }

/**
 * C165 — the product cut: only events that START on/after the legal campaign
 * start (`CALENDAR_PHASE_ANCHORS.consolidationStart`) are imported — no
 * backfill, ever. The comparison is a Bahia civil date (the day turns at
 * midnight in Bahia, not in UTC), the same rule the phase anchors use.
 */
export const isImportableGoogleEvent = (
  event: GoogleRemoteEvent,
  window: GoogleEventImportWindow,
): boolean => {
  if (!event.id || event.status === GOOGLE_EVENT_STATUS_CANCELLED) return false
  if (!isForeignGoogleEvent(event)) return false
  const schedule = googleScheduleToActivityFields(event)
  if (!schedule?.startAt) return false

  const startMs = Date.parse(schedule.startAt)
  const rangeStartMs = Date.parse(window.rangeStart)
  const rangeEndMs = Date.parse(window.rangeEnd)
  if (Number.isNaN(startMs) || !(startMs >= rangeStartMs && startMs < rangeEndMs)) return false

  return (
    formatBahiaCivilDate(new Date(schedule.startAt)) >= CALENDAR_PHASE_ANCHORS.consolidationStart
  )
}

/**
 * Short deterministic digest of the Google event id (FNV-1a, base36). The
 * slug suffix must be unique even for two distinct events with the same title
 * and start (duplicated invites are real): the event id is the only unique
 * input, and hashing keeps the slug reproducible across passes.
 */
const shortGoogleEventHash = (eventId: string): string => {
  let hash = 2166136261
  for (let index = 0; index < eventId.length; index += 1) {
    hash ^= eventId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

/**
 * C165 — deterministic slug for an imported event: title + occurrence (civil
 * date/date-time in Bahia) + event digest. The occurrence suffix keeps two
 * instances of a recurring series apart; the digest keeps equal title+start
 * events apart.
 */
const importedActivitySlug = (
  title: string,
  schedule: { startAt: string | null; allDay: boolean },
  eventId: string,
): string => {
  const occurrence = schedule.allDay
    ? allDayCivilDateOf(schedule.startAt ?? '')
    : formatIsoAsBahiaDateTimeInput(schedule.startAt ?? '')
  const suffix = occurrence.replace(/[-:]/g, '')
  const base = slugify(title) || 'evento'
  return `${base}-${suffix}-${shortGoogleEventHash(eventId)}`
}

/**
 * C165 — the activity an imported Google event is born as: `confirmado`,
 * title verbatim (no `[Município] ` prefix — that prefix belongs to mirrored
 * events), `location → locality`, description deliberately ignored (the text
 * lives in Google), and the system-write link that makes the import
 * idempotent. Null when the event has no usable title/schedule (skip — never
 * invent a title in an immutable field, never pause the pass).
 */
export const buildImportedGoogleEventActivity = (
  event: GoogleRemoteEvent,
  calendarId: string,
): {
  title: string
  slug: string
  status: 'confirmado'
  startAt: string
  endAt?: string
  allDay: boolean
  locality?: string
  googleEventId: string
  googleCalendarId: string
  tags: string[]
} | null => {
  if (!event.id) return null
  const title = googleTitleFromSummary(event.summary, undefined)
  if (!title || title.length < 2 || slugify(title) === '') return null

  const schedule = googleScheduleToActivityFields(event)
  if (!schedule?.startAt) return null

  const locality = event.location?.trim().slice(0, 160)

  return {
    title,
    slug: importedActivitySlug(title, schedule, event.id),
    status: 'confirmado',
    startAt: schedule.startAt,
    ...(schedule.endAt ? { endAt: schedule.endAt } : {}),
    allDay: schedule.allDay,
    ...(locality ? { locality } : {}),
    googleEventId: event.id,
    googleCalendarId: calendarId,
    tags: [],
  }
}

/**
 * C165 — the partial event the engine PATCHes for an imported activity: only
 * the fields the Teqo owns from then on (title, schedule, location). No
 * `description` (the Google text is preserved by the partial PATCH), no
 * `id` (the linked remote id is the target), no prefix on the summary.
 */
export type GoogleImportedEventPatch = {
  summary: string
  location: string
  start: GoogleCalendarEventPayload['start']
  end: GoogleCalendarEventPayload['end']
}

export const buildImportedGoogleEventPatch = (
  activity: Pick<Activity, 'title' | 'startAt' | 'endAt' | 'allDay' | 'locality'>,
): GoogleImportedEventPatch => {
  const { start, end } = buildGoogleEventSchedule(activity)
  return {
    summary: activity.title,
    location: activity.locality?.trim() ?? '',
    start,
    end,
  }
}

/**
 * C165 — content equality for imported activities: summary + schedule +
 * location. Description is out by design (the Teqo never reads, stores or
 * writes the Google description of an imported event).
 */
export const googleImportedEventContentEquals = (
  remote: GoogleRemoteEvent,
  patch: GoogleImportedEventPatch,
): boolean =>
  (remote.summary ?? '') === patch.summary &&
  (remote.location ?? '') === patch.location &&
  startEndInstantEquals(remote.start, patch.start) &&
  startEndInstantEquals(remote.end, patch.end)
