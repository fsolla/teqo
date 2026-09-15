/**
 * C115 — pure mapping from a Google Calendar event edit back to the campaign
 * activity fields: the reverse of `googleCalendarEventMapping`. The Google
 * event is never authoritative — the engine applies these values to the
 * activity only when the clock rule says the Google edit is newer, and every
 * other field (municipality, tags, locality, description…) stays Teqo-owned.
 *
 * This module is pure and client-safe; only the engine touches the network.
 */
import { formatAllDayRangeLabel } from '@/lib/activityAllDay'
import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'

/** Body prefix that marks an activity-update entry as written by the reverse direction. */
export const GOOGLE_REVERSE_EDIT_BODY_PREFIX = 'Google Calendar:'

/** The v1 editable fields (título/horário/cancelamento) — nothing else propagates. */
export type GoogleReverseActivityEdit = {
  title?: string
  startAt?: string | null
  endAt?: string | null
  allDay?: boolean | null
}

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
