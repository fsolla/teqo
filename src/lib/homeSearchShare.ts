/** Share payload for a home-search hit — title plus canonical detail URL. */
export const buildHomeSearchShareText = (title: string, absoluteUrl: string): string =>
  `${title}\n${absoluteUrl}`

/** `wa.me` share link with pre-filled text (no recipient phone). */
export const buildWhatsAppTextShareUrl = (message: string): string => {
  const url = new URL('https://wa.me/')
  url.searchParams.set('text', message)
  return url.toString()
}

const canUseNativeWebShare = (): boolean =>
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.share === 'function'

export type HomeSearchShareStrategy = 'native' | 'whatsapp'

/** Native Web Share when available; otherwise WhatsApp text share (desktop fallback). */
export const resolveHomeSearchShareStrategy = (): HomeSearchShareStrategy =>
  canUseNativeWebShare() ? 'native' : 'whatsapp'

export const buildHomeSearchWhatsAppShareHref = (title: string, absoluteUrl: string): string =>
  buildWhatsAppTextShareUrl(buildHomeSearchShareText(title, absoluteUrl))

/** Absolute URL for a campaign detail path — client-only call sites. */
export const buildHomeSearchDetailUrl = (path: string): string => {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}
