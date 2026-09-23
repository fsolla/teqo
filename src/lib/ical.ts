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

// RFC 5545 §3.1 counts octets, not UTF-16 code units: the limit is 75 octets
// per physical line, and each continuation line spends one octet on its
// leading space (so 74 octets of payload). Never split a code point — the cut
// backs off to the last UTF-8 boundary.
const MAX_OCTETS = 75
const CONTINUATION_PAYLOAD_OCTETS = MAX_OCTETS - 1

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/**
 * Folds one logical content line into its RFC 5545 physical lines. Lines of up
 * to 75 octets come back untouched; longer ones are split at the octet
 * boundary with `CRLF + 1 space` and never split a multi-byte character. The
 * input must not contain CRLF (logical lines only).
 */
export const foldICalLine = (line: string): string => {
  const bytes = textEncoder.encode(line)
  if (bytes.length <= MAX_OCTETS) return line

  const segments: string[] = []
  let start = 0
  let chunkOctets = MAX_OCTETS

  while (start < bytes.length) {
    let end = Math.min(start + chunkOctets, bytes.length)
    while (end > start && (bytes[end] & 0xc0) === 0x80) end -= 1

    segments.push(textDecoder.decode(bytes.subarray(start, end)))
    start = end
    chunkOctets = CONTINUATION_PAYLOAD_OCTETS
  }

  return segments.join('\r\n ')
}
