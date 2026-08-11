/**
 * C114 — public "add this calendar" links for the campaign's shared Google
 * calendar. The calendar itself is created in the campaign's Google account
 * (never by a service account — Google's recommendation) and shared publicly
 * by link (ops runbook); these URLs are what the team receives:
 *
 * - Google Calendar: the `cid` webcal URL (the established add-by-URL flow the
 *   iCal feed dialog already uses, `calendar/r/settings/addbyurl`).
 * - Apple Calendar / Outlook: subscribe straight to the webcal URL the Google
 *   calendar exposes for public calendars.
 *
 * Both require the calendar to be public in the owner's sharing settings —
 * the link IS the credential, same model as the iCal feed secret.
 */
const GOOGLE_CALENDAR_ADD_BASE = 'https://calendar.google.com/calendar/r'
const GOOGLE_CALENDAR_ICAL_BASE = 'https://calendar.google.com/calendar/ical'

export const buildGoogleCalendarWebcalUrl = (calendarId: string): string =>
  `webcal://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`

export const buildGoogleCalendarAddLink = (calendarId: string): string => {
  const webcal = buildGoogleCalendarWebcalUrl(calendarId)
  return `${GOOGLE_CALENDAR_ADD_BASE}?cid=${encodeURIComponent(webcal)}`
}

/** The public iCal URL of the shared calendar — same `cid` target, plain HTTPS. */
export const buildGoogleCalendarPublicIcalUrl = (calendarId: string): string =>
  `${GOOGLE_CALENDAR_ICAL_BASE}/${encodeURIComponent(calendarId)}/public/basic.ics`
