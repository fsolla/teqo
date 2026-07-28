/**
 * A short, human name for the device behind a user-agent string, used to
 * pre-fill the passkey label so enrolling is one tap and no typing (B40).
 *
 * Deliberately coarse: this is a suggestion the person can overwrite, and it
 * has to read like something they would say out loud ("iPhone", "Android"),
 * not like a fingerprint of their browser. It is resolved on the server from
 * the request header so the input has its value on first paint.
 */

const PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/iPhone/i, 'iPhone'],
  [/iPad/i, 'iPad'],
  [/Android/i, 'Android'],
  [/Macintosh|Mac OS X/i, 'Mac'],
  [/Windows/i, 'Windows'],
  [/CrOS/i, 'Chromebook'],
  [/Linux/i, 'Linux'],
]

const FALLBACK_DEVICE_LABEL = 'Este aparelho'

export const deviceLabelFromUserAgent = (userAgent: string | null | undefined): string => {
  if (!userAgent) return FALLBACK_DEVICE_LABEL

  // iPadOS reports itself as a Macintosh with touch points, which the header
  // alone cannot distinguish — "Mac" is the honest answer from here.
  const match = PATTERNS.find(([pattern]) => pattern.test(userAgent))
  return match ? match[1] : FALLBACK_DEVICE_LABEL
}
