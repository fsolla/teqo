/**
 * C193 — pure response rules of a private reel artifact: the safe content type,
 * the content disposition and the range/private headers. No I/O and no
 * `server-only`: the streaming utility and the unit tests share this module.
 */

/** Only these may render inline; anything else is forced to download. */
const REEL_MEDIA_INLINE_MIME_TYPES = ['video/mp4', 'audio/mpeg', 'image/png', 'image/jpeg'] as const

export const REEL_MEDIA_FALLBACK_MIME_TYPE = 'application/octet-stream'
export const REEL_MEDIA_CACHE_CONTROL = 'private, no-store'

export type ReelMediaRange = {
  status: number
  headers: Record<string, string>
}

const isInlineSafe = (mimeType: unknown): mimeType is string =>
  typeof mimeType === 'string' &&
  (REEL_MEDIA_INLINE_MIME_TYPES as readonly string[]).includes(mimeType)

/**
 * The served content type is the stored one only when it is safe to render
 * inline; everything else degrades to `application/octet-stream` (never an
 * attacker-chosen type executed in the campaign origin).
 */
export const reelMediaContentType = (mimeType: string | null | undefined): string =>
  isInlineSafe(mimeType) ? mimeType : REEL_MEDIA_FALLBACK_MIME_TYPE

/** Both `filename` and `filename*` (RFC 5987) so non-ASCII names survive. */
export const reelMediaContentDisposition = (
  filename: string | null | undefined,
  download: boolean,
): string => {
  const name = filename?.trim() || 'arquivo'
  const asciiFallback = name.replace(/[^\w.-]+/g, '_')
  const disposition = download ? 'attachment' : 'inline'
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/**
 * The response headers of one artifact: the range headers computed from the
 * real file size plus the private streaming contract. Pure.
 */
export const reelMediaHeaders = ({
  range,
  mimeType,
  filename,
  download,
}: {
  range: ReelMediaRange
  mimeType: string | null | undefined
  filename: string | null | undefined
  download: boolean
}): Headers => {
  const headers = new Headers(range.headers)
  const contentType = reelMediaContentType(mimeType)
  const forceDownload = download || contentType === REEL_MEDIA_FALLBACK_MIME_TYPE

  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', reelMediaContentDisposition(filename, forceDownload))
  headers.set('Cache-Control', REEL_MEDIA_CACHE_CONTROL)
  headers.set('X-Content-Type-Options', 'nosniff')
  if (forceDownload) headers.set('Content-Security-Policy', "default-src 'none'")
  return headers
}
