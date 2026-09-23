/**
 * Shared iCal primitives (RFC 5545). They live in `lib/` because two owners
 * need the exact same escaping/formatting: the campaign agenda feed
 * (`utilities/calendarFeed.ts`) and the public share-link `.ics`
 * (`lib/calendarEvent.ts`). One implementation, pinned by unit tests.
 */

export const escapeICalText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

export const formatICalDate = (isoString: string): string =>
  isoString.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
