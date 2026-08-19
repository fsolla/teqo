const FACEBOOK_PIXEL_ID_PATTERN = /^\d{5,20}$/

// Shared admin copy: every surface that takes a Pixel ID must say the same
// thing — only the numeric ID, never the full snippet (drift would invite XSS).
export const FACEBOOK_PIXEL_ID_DESCRIPTION =
  'Cole somente o ID numérico do Events Manager (ex.: 123456789012345), não o snippet HTML completo.'

export function isValidFacebookPixelId(value: string | null | undefined): boolean {
  if (value == null || value === '') return false
  return FACEBOOK_PIXEL_ID_PATTERN.test(value)
}

export function normalizeFacebookPixelId(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return isValidFacebookPixelId(trimmed) ? trimmed : null
}

// Payload field validation shared by every admin surface that takes a Pixel ID
// (petition + site settings): optional field, digits only when present.
export function validateFacebookPixelId(value: string | null | undefined): true | string {
  if (!value) return true
  if (!normalizeFacebookPixelId(String(value))) {
    return 'Informe somente o ID numérico do Pixel (5 a 20 dígitos), sem HTML ou script.'
  }
  return true
}

declare global {
  interface Window {
    fbq?: (
      command: 'track',
      eventName: string,
      params?: Record<string, string>,
      options?: { eventID: string },
    ) => void
  }
}

export function trackMetaLead(pixelId: string, contentName: string, eventID: string): void {
  if (typeof window === 'undefined') return
  if (!isValidFacebookPixelId(pixelId)) return

  const fbq = window.fbq
  if (!fbq) return

  fbq('track', 'Lead', { content_name: contentName }, { eventID })
}
