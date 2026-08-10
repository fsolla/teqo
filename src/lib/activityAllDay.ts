import {
  civilDateDaysBetween,
  formatBahiaCivilDate,
  parseBahiaDateTimeInput,
  subtractBahiaCivilDays,
} from '@/lib/campaignTime'

/**
 * C104 — all-day activity schedule conventions. When `activity.allDay` is
 * true, the stored instants are day-boundary in America/Bahia (fixed −03, no
 * DST): `startAt` = first day at 00:00, `endAt` = last day at 00:00 — an
 * INCLUSIVE end (the date part of `endAt` IS the last day; a single-day
 * commitment has `startAt === endAt`). The consumer's intent is stored as-is;
 * only the calendar boundaries that need an exclusive end (FullCalendar
 * events, iCal `DTEND;VALUE=DATE`) convert through this module.
 *
 * This module is pure and client-safe: the agenda (client) and the server
 * (schema, form parsing, iCal feed) share the same conversions, so the
 * inclusive/exclusive off-by-one can only live here — where tests pin it.
 */

const civilDatePattern = /^\d{4}-\d{2}-\d{2}$/

export const isCivilDate = (value: string): boolean => civilDatePattern.test(value)

/** The date part (`aaaa-mm-dd`, Bahia civil) of a stored all-day instant. */
export const allDayCivilDateOf = (iso: string): string => formatBahiaCivilDate(new Date(iso))

/** Stored start instant for the first day of an all-day commitment. */
export const allDayStartInstant = (civilDate: string): string => {
  const instant = parseBahiaDateTimeInput(`${civilDate}T00:00`)
  if (!instant) throw new Error('Data de dia inteiro inválida.')
  return instant
}

/** Stored end instant for the last day of an all-day commitment (inclusive). */
export const allDayEndInstant = (civilDate: string): string => allDayStartInstant(civilDate)

/** Calendar-exclusive end: the day AFTER the last stored day. */
export const allDayExclusiveEndDate = (endIso: string): string =>
  subtractBahiaCivilDays(allDayCivilDateOf(endIso), -1)

/** Exclusive end date (FullCalendar drop/resize) → stored inclusive instant. */
export const allDayEndInstantFromExclusive = (exclusiveDate: string): string =>
  allDayEndInstant(subtractBahiaCivilDays(exclusiveDate, 1))

/** All-day ranges allow the end date to equal the start date. */
export const allDayRangeValid = (startIso: string, endIso: string): boolean =>
  civilDateDaysBetween(allDayCivilDateOf(startIso), allDayCivilDateOf(endIso)) >= 0

const formatCivilDateLabel = (iso: string): string => {
  const [year, month, day] = allDayCivilDateOf(iso).split('-')
  return `${day}/${month}/${year}`
}

/**
 * pt-BR label for an all-day commitment: "10/08/2026" for a single day,
 * "10/08/2026 a 12/08/2026" for a multi-day range. Pure string arithmetic —
 * the label never depends on the browser locale (C97 precedent).
 */
export const formatAllDayRangeLabel = (startIso: string, endIso?: string | null): string => {
  const start = formatCivilDateLabel(startIso)
  if (!endIso) return start
  const end = formatCivilDateLabel(endIso)
  return end === start ? start : `${start} a ${end}`
}
