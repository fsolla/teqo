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

  it('builds the Google add-by-URL link with the webcal URL as cid', () => {
    const link = buildGoogleCalendarAddLink(calendarId)
    expect(link).toBe(
      'https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fcalendar.google.com%2Fcalendar%2Fical%2Fc_abc123%2540group.calendar.google.com%2Fpublic%2Fbasic.ics',
    )
  })

  it('builds the public HTTPS iCal URL of the same calendar', () => {
    expect(buildGoogleCalendarPublicIcalUrl(calendarId)).toBe(
      'https://calendar.google.com/calendar/ical/c_abc123%40group.calendar.google.com/public/basic.ics',
    )
  })
})
