/**
 * C193/C199 — pure response rules of a private media artifact: the safe content
 * type, the content disposition, the range/private headers and the classification
 * of an absent object. No I/O and no `server-only`: the streaming utility and the
 * unit tests share this module.
 *
 * The owner serves every private upload collection (`reelMedia`, `recordingMedia`)
 * through the authenticated `/campanha` routes; the public `media` contract
 * never touches this module.
 */

/**
 * Only these may render inline; anything else is forced to download. C199 adds
 * the video containers the recordings actually arrive in (MOV/MKV/WebM) — all
 * inert media types, never markup executed in the campaign origin. S27 adds the
 * image and audio families the content pieces accept (a published photo must
 * render and an audio piece must play; both were degrading to octet-stream and
 * turning into a download). HEIC/HEIF stay out on purpose (browsers do not
 * render them) and `image/svg+xml` never enters (markup).
 */
const PRIVATE_MEDIA_INLINE_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
  'audio/wav',
  'audio/webm',
  'audio/flac',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
] as const

export const PRIVATE_MEDIA_FALLBACK_MIME_TYPE = 'application/octet-stream'
export const PRIVATE_MEDIA_CACHE_CONTROL = 'private, no-store'

export type PrivateMediaRange = {
  status: number
  headers: Record<string, string>
}

/**
 * True when the read error means the OBJECT is absent in whichever store served
 * it: S3 `NoSuchKey`/`NotFound` (or a 404 in the SDK metadata) or the local disk
 * `ENOENT`. Everything else — a checksum mismatch included — is a real read
 * failure of an object that exists (C246 classifies it as corrupt, never as
 * missing). Pure so the response paths, the integrity sweep and the unit spec
 * share one classification.
 */
export const isPrivateMediaMissingError = (error: unknown): boolean => {
  if ((error as { code?: unknown } | null)?.code === 'ENOENT') return true
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  const errorCode = 'Code' in error ? String(error.Code) : ''
  const metadata =
    '$metadata' in error && error.$metadata && typeof error.$metadata === 'object'
      ? (error.$metadata as { httpStatusCode?: number })
      : null
  return (
    name === 'NoSuchKey' ||
    name === 'NotFound' ||
    errorCode === 'NoSuchKey' ||
    metadata?.httpStatusCode === 404
  )
}

/**
 * C248 — AVIF negotiation for the stored grade thumbnail. The token must be
 * EXPLICIT (`image/avif`) with a positive quality: a missing header, a
 * wildcard or `image/jpeg` stays on the JPEG fallback, so every client that
 * never opted in (curl, the e2e API request context, a browser without the
 * decoder) keeps the exact answer it has today. Pure, so the route and the
 * unit spec share the classification.
 */
export const acceptsAvif = (acceptHeader: string | null | undefined): boolean => {
  if (typeof acceptHeader !== 'string') return false
  for (const part of acceptHeader.split(',')) {
    const [rawType, ...params] = part.split(';')
    if (rawType.trim().toLowerCase() !== 'image/avif') continue

    let quality = 1
    for (const param of params) {
      const [rawKey, rawValue] = param.split('=')
      if (rawKey?.trim().toLowerCase() !== 'q') continue
      const parsed = Number(rawValue)
      // A malformed weight must never arm AVIF: only a real positive q does.
      quality = Number.isFinite(parsed) ? parsed : 0
    }
    return quality > 0
  }
  return false
}

const isInlineSafe = (mimeType: unknown): mimeType is string =>
  typeof mimeType === 'string' &&
  (PRIVATE_MEDIA_INLINE_MIME_TYPES as readonly string[]).includes(mimeType)

/**
 * The served content type is the stored one only when it is safe to render
 * inline; everything else degrades to `application/octet-stream` (never an
 * attacker-chosen type executed in the campaign origin).
 */
export const privateMediaContentType = (mimeType: string | null | undefined): string =>
  isInlineSafe(mimeType) ? mimeType : PRIVATE_MEDIA_FALLBACK_MIME_TYPE

/** Both `filename` and `filename*` (RFC 5987) so non-ASCII names survive. */
export const privateMediaContentDisposition = (
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
export const privateMediaHeaders = ({
  range,
  mimeType,
  filename,
  download,
}: {
  range: PrivateMediaRange
  mimeType: string | null | undefined
  filename: string | null | undefined
  download: boolean
}): Headers => {
  const headers = new Headers(range.headers)
  const contentType = privateMediaContentType(mimeType)
  const forceDownload = download || contentType === PRIVATE_MEDIA_FALLBACK_MIME_TYPE

  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', privateMediaContentDisposition(filename, forceDownload))
  headers.set('Cache-Control', PRIVATE_MEDIA_CACHE_CONTROL)
  headers.set('X-Content-Type-Options', 'nosniff')
  if (forceDownload) headers.set('Content-Security-Policy', "default-src 'none'")
  return headers
}
