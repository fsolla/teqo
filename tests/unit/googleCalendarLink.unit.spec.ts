import { describe, expect, it } from 'vitest'

import {
  buildGoogleCalendarAddLink,
  buildGoogleCalendarPublicIcalUrl,
  buildGoogleCalendarWebcalUrl,
} from '@/lib/googleCalendarLink'

describe('googleCalendarLink', () => {
  const calendarId = 'c_abc123@group.calendar.google.com'

  it('builds the webcal subscription URL Apple/Outlook consume', () => {
    expect(buildGoogleCalendarWebcalUrl(calendarId)).toBe(
      'webcal://calendar.google.com/calendar/ical/c_abc123%40group.calendar.google.com/public/basic.ics',
    )
  })

  it('builds the one-click Google add link with the calendarId as cid (C150)', () => {
    const link = buildGoogleCalendarAddLink(calendarId)
    expect(link).toBe(
      'https://calendar.google.com/calendar/r?cid=c_abc123%40group.calendar.google.com',
    )
  })

  it('builds the public HTTPS iCal URL of the same calendar', () => {
    expect(buildGoogleCalendarPublicIcalUrl(calendarId)).toBe(
      'https://calendar.google.com/calendar/ical/c_abc123%40group.calendar.google.com/public/basic.ics',
    )
  })
})
