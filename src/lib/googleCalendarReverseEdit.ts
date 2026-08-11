/**
 * C115 — pure mapping from a Google Calendar event edit back to the campaign
 * activity fields: the reverse of `googleCalendarEventMapping`. The Google
 * event is never authoritative — the engine applies these values to the
 * activity only when the clock rule says the Google edit is newer, and every
 * other field (municipality, tags, locality, description…) stays Teqo-owned.
 *
 * This module is pure and client-safe; only the engine touches the network.
 */
import {
  allDayEndInstantFromExclusive,
  allDayStartInstant,
  formatAllDayRangeLabel,
  isCivilDate,
} from '@/lib/activityAllDay'
import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'
import type { GoogleRemoteEvent } from '@/lib/googleCalendarEventMapping'

/** Body prefix that marks an activity-update entry as written by the reverse direction. */
export const GOOGLE_REVERSE_EDIT_BODY_PREFIX = 'Google Calendar:'

/** The v1 editable fields (título/horário/cancelamento) — nothing else propagates. */
export type GoogleReverseActivityEdit = {
  title?: string
  startAt?: string | null
  endAt?: string | null
  allDay?: boolean | null
}

/** Matches the `title` field cap in the Activity collection — the same bound the Teqo form enforces. */
const ACTIVITY_TITLE_MAX_LENGTH = 160

/**
 * D3 — the conflict clock rule: the Google edit wins only when its `updated`
 * instant is strictly newer than the activity's last Teqo write, with a small
 * tolerance for NTP skew between Google and the database (both are
 * NTP-synced). Content equality is checked BEFORE this rule, so repeated
 * passes converge without ever reaching it.
 */
export const googleEditIsNewer = (
  remoteUpdated: string | undefined,
  activityUpdatedAt: string | undefined,
  toleranceMs = 2_000,
): boolean => {
  if (!remoteUpdated || !activityUpdatedAt) return false
  const remoteMs = Date.parse(remoteUpdated)
  const localMs = Date.parse(activityUpdatedAt)
  if (Number.isNaN(remoteMs) || Number.isNaN(localMs)) return false
  return remoteMs > localMs + toleranceMs
}

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
): Pick<GoogleReverseActivityEdit, 'startAt' | 'endAt' | 'allDay'> | null => {
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

const scheduleLabelOf = (
  schedule: Pick<GoogleReverseActivityEdit, 'startAt' | 'endAt' | 'allDay'>,
): string | null => {
  const { startAt, endAt, allDay } = schedule
  if (!startAt) return null
  if (allDay) return formatAllDayRangeLabel(startAt, endAt ?? null)
  const start = formatBahiaDateTimeLabel(startAt)
  if (endAt && endAt !== startAt) return `${start} — ${formatBahiaDateTimeLabel(endAt)}`
  return start
}

/**
 * The audit entry ("com registro"): a concise pt-BR line describing what the
 * Google edit changed, prefixed for the feed to attribute it to Google.
 */
export const buildGoogleReverseUpdateBody = (
  previous: Pick<GoogleReverseActivityEdit, 'title' | 'startAt' | 'endAt' | 'allDay'>,
  next: Pick<GoogleReverseActivityEdit, 'title' | 'startAt' | 'endAt' | 'allDay'>,
): string => {
  const parts: string[] = []
  if (next.title !== undefined && next.title !== previous.title) {
    parts.push(`título alterado para "${next.title}"`)
  }
  const previousSchedule = scheduleLabelOf(previous)
  const nextSchedule = scheduleLabelOf(next)
  if (nextSchedule && nextSchedule !== previousSchedule) {
    parts.push(`remarcada — antes ${previousSchedule}, agora ${nextSchedule}`)
  }
  if (parts.length === 0) return `${GOOGLE_REVERSE_EDIT_BODY_PREFIX} compromisso atualizado`
  return `${GOOGLE_REVERSE_EDIT_BODY_PREFIX} ${parts.join('; ')}`
}

/** The cancellation record — the reverse direction reuses it for the updates feed. */
export const buildGoogleReverseCancelBody = (): string =>
  `${GOOGLE_REVERSE_EDIT_BODY_PREFIX} cancelada`
