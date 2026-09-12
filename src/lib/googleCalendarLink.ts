/**
 * C114/C150 — public "add this calendar" links for the campaign's shared
 * Google calendar. The calendar itself is created in the campaign's Google
 * account (never by a service account — Google's recommendation) and shared
 * publicly by link (ops runbook); these URLs are what the team receives:
 *
 * - Google Calendar: the `cid` calendarId (C150) — Google opens the calendar
 *   ready to subscribe, no "add by URL" step.
 * - Google Calendar "add by URL", Apple Calendar and Outlook: the public iCal
 *   URL of the same calendar (manual path).
 *
 * Both require the calendar to be public in the owner's sharing settings —
 * the link IS the credential, same model as the iCal feed secret.
 */
const GOOGLE_CALENDAR_ADD_BASE = 'https://calendar.google.com/calendar/r'
const GOOGLE_CALENDAR_ICAL_BASE = 'https://calendar.google.com/calendar/ical'

/** C150 — the one-click add link: `cid` carries the calendar id itself. */
export const buildGoogleCalendarAddLink = (calendarId: string): string =>
  `${GOOGLE_CALENDAR_ADD_BASE}?cid=${encodeURIComponent(calendarId)}`

/** The public iCal URL of the shared calendar — the manual "add by URL" target. */
export const buildGoogleCalendarPublicIcalUrl = (calendarId: string): string =>
  `${GOOGLE_CALENDAR_ICAL_BASE}/${encodeURIComponent(calendarId)}/public/basic.ics`
