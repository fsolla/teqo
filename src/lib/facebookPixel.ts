const FACEBOOK_PIXEL_ID_PATTERN = /^\d{5,20}$/

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

export function trackMetaLead(
  pixelId: string,
  contentName: string,
  eventID: string,
): void {
  if (typeof window === 'undefined') return
  if (!isValidFacebookPixelId(pixelId)) return

  const fbq = window.fbq
  if (!fbq) return

  fbq('track', 'Lead', { content_name: contentName }, { eventID })
}
