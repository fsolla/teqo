import { z } from 'zod'

/**
 * C215 — pure contract of the web-speech ingestion: the platform taxonomy, the
 * finding-batch schema the discovery (C218) hands over, the natural key
 * (`web:<platform>:<externalId|url>`) and the canonical URL normalization that
 * keeps re-runs idempotent. No I/O: the CLI, the pipeline and the tests share
 * this module.
 */

export const WEB_SPEECH_PLATFORMS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'radio', label: 'Rádio' },
  { value: 'audio', label: 'Áudio' },
] as const

export type WebSpeechPlatform = (typeof WEB_SPEECH_PLATFORMS)[number]['value']

const WEB_SPEECH_PLATFORM_VALUES = WEB_SPEECH_PLATFORMS.map((platform) => platform.value) as [
  WebSpeechPlatform,
  ...WebSpeechPlatform[],
]

export const webSpeechPlatformLabel = (value: WebSpeechPlatform): string =>
  WEB_SPEECH_PLATFORMS.find((platform) => platform.value === value)?.label ?? value

/** Owner of the private upload collection slug (collection, config and S3). */
export const INTERNET_SPEECH_MEDIA_SLUG = 'internetSpeechMedia' as const

/**
 * Platforms whose acquisition goes through yt-dlp. The others (`radio`,
 * `audio`) are direct files: the finding must carry `mediaUrl` or the item
 * fails honestly in the report — the script never guesses a page's media.
 */
const YTDLP_PLATFORMS: readonly WebSpeechPlatform[] = ['youtube', 'instagram']

export const requiresDirectMediaUrl = (platform: WebSpeechPlatform): boolean =>
  !YTDLP_PLATFORMS.includes(platform)

const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'igshid', 'igsh', 'si', 'feature'])

const isTrackingParam = (name: string): boolean =>
  TRACKING_PARAMS.has(name) || name.toLowerCase().startsWith('utm_')

const stripTrackingParams = (url: URL): void => {
  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParam(name)) url.searchParams.delete(name)
  }
}

const withoutTrailingSlash = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.replace(/\/+$/, '') : pathname

const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com'])
const YOUTU_BE_HOSTS = new Set(['youtu.be'])

const normalizedHost = (url: URL): string => url.hostname.toLowerCase().replace(/^www\./, '')

const firstPathSegment = (pathname: string): string | null =>
  pathname.split('/').find((segment) => segment !== '') ?? null

/** Video id from any YouTube URL shape (`watch`, `shorts`, `live`, `embed`, `youtu.be`). */
const youtubeVideoId = (url: URL): string | null => {
  const host = normalizedHost(url)
  if (YOUTU_BE_HOSTS.has(host)) return firstPathSegment(url.pathname)
  if (!YOUTUBE_HOSTS.has(host)) return null
  if (url.pathname === '/watch') return url.searchParams.get('v')
  const match = /^\/(?:shorts|live|embed)\/([^/?#]+)/.exec(url.pathname)
  return match?.[1] ?? null
}

/** Shortcode + kind (`reel`/`p`/`tv`) from any Instagram post URL. */
const instagramPost = (url: URL): { kind: string; code: string } | null => {
  if (normalizedHost(url) !== 'instagram.com') return null
  const match = /^\/(p|reel|reels|tv)\/([^/?#]+)/.exec(url.pathname)
  if (!match) return null
  return { kind: match[1] === 'reels' ? 'reel' : match[1], code: match[2] }
}

const parseUrl = (raw: string): URL | null => {
  try {
    return new URL(raw.trim())
  } catch {
    return null
  }
}

/**
 * Stable URL for identity and provenance: YouTube/Instagram collapse to the
 * canonical post URL and every platform drops tracking params, the fragment
 * and a trailing slash. An unparseable URL returns trimmed as-is (the finding
 * schema validates the shape before this runs).
 */
export const canonicalWebSpeechUrl = (platform: WebSpeechPlatform, rawUrl: string): string => {
  const url = parseUrl(rawUrl)
  if (!url) return rawUrl.trim()

  if (platform === 'youtube') {
    const videoId = youtubeVideoId(url)
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`
  }
  if (platform === 'instagram') {
    const post = instagramPost(url)
    if (post) return `https://www.instagram.com/${post.kind}/${post.code}/`
  }

  url.hash = ''
  stripTrackingParams(url)
  url.hostname = url.hostname.toLowerCase()
  url.pathname = withoutTrailingSlash(url.pathname)
  return url.toString()
}

/**
 * Natural key of one web speech. `externalId` wins when the discovery already
 * knows the platform id; otherwise the canonical URL is the identity — the
 * same URL always produces the same key, so re-running never duplicates.
 */
export const webSpeechSourceKey = ({
  platform,
  url,
  externalId,
}: {
  platform: WebSpeechPlatform
  url: string
  externalId?: string | null
}): string => {
  const id = externalId?.trim()
  return id ? `web:${platform}:${id}` : `web:${platform}:${canonicalWebSpeechUrl(platform, url)}`
}

/** A web speech row is complete when it has both the transcript and the mirrored file. */
export const isCompleteWebSpeechState = (
  state: { segmentCount: number; mirroredMedia: number | null } | null,
): boolean => state !== null && state.segmentCount > 0 && state.mirroredMedia !== null

const PUBLISHED_AT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/
const TIMEZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/

const isValidCalendarDay = (year: string, month: string, day: string): boolean => {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  )
}

/**
 * `speechAt` (Brasília wall-clock text, same contract as the Câmara rows) from
 * the discovery's `publishedAt` — day-only becomes midnight and an explicit
 * timezone is converted to America/Bahia. Unrecognized values return null so
 * the finding fails validation instead of inventing a date.
 */
export const webSpeechAtFromPublishedAt = (publishedAt: string): string | null => {
  const trimmed = publishedAt.trim()

  if (TIMEZONE_SUFFIX.test(trimmed)) {
    const instant = new Date(trimmed)
    if (Number.isNaN(instant.getTime())) return null
    // sv-SE renders the ISO-like `YYYY-MM-DD HH:mm` for the requested zone.
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Bahia',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(instant)
      .replace(' ', 'T')
  }

  const match = PUBLISHED_AT_PATTERN.exec(trimmed)
  if (!match) return null
  const [, year, month, day, hour = '00', minute = '00'] = match
  if (!isValidCalendarDay(year, month, day)) return null
  if (Number(hour) > 23 || Number(minute) > 59) return null
  return `${year}-${month}-${day}T${hour}:${minute}`
}

const MAX_TITLE_LENGTH = 300
const MAX_CHANNEL_LENGTH = 200

const webSpeechFindingSchema = z
  .object({
    platform: z.enum(WEB_SPEECH_PLATFORM_VALUES, { error: 'plataforma desconhecida' }),
    url: z.string({ error: 'url obrigatória' }).trim().url('url inválida'),
    mediaUrl: z.string().trim().url('mediaUrl inválida').optional(),
    externalId: z.string().trim().min(1, 'externalId vazio').optional(),
    title: z
      .string()
      .trim()
      .min(1, 'título vazio')
      .max(MAX_TITLE_LENGTH, `título até ${MAX_TITLE_LENGTH} caracteres`)
      .optional(),
    channel: z
      .string()
      .trim()
      .min(1, 'canal vazio')
      .max(MAX_CHANNEL_LENGTH, `canal até ${MAX_CHANNEL_LENGTH} caracteres`)
      .optional(),
    publishedAt: z
      .string({ error: 'publishedAt obrigatório' })
      .trim()
      .min(4, 'publishedAt inválido'),
    durationSeconds: z
      .number({ error: 'durationSeconds inválido' })
      .finite()
      .nonnegative('durationSeconds inválido')
      .optional(),
    thumbnailUrl: z.string().trim().url('thumbnailUrl inválida').optional(),
  })
  .superRefine((finding, context) => {
    if (requiresDirectMediaUrl(finding.platform) && !finding.mediaUrl) {
      context.addIssue({
        code: 'custom',
        path: ['mediaUrl'],
        message: `Achado de ${webSpeechPlatformLabel(finding.platform)} exige mediaUrl (arquivo direto).`,
      })
    }
    if (webSpeechAtFromPublishedAt(finding.publishedAt) === null) {
      context.addIssue({
        code: 'custom',
        path: ['publishedAt'],
        message: 'publishedAt deve ser YYYY-MM-DD ou data/hora ISO.',
      })
    }
  })

export type WebSpeechFinding = z.infer<typeof webSpeechFindingSchema>

export type WebSpeechFindingParseResult =
  | { ok: true; finding: WebSpeechFinding }
  | { ok: false; error: string }

export const parseWebSpeechFinding = (value: unknown): WebSpeechFindingParseResult => {
  const parsed = webSpeechFindingSchema.safeParse(value)
  if (parsed.success) return { ok: true, finding: parsed.data }
  const issue = parsed.error.issues[0]
  const path = issue?.path.join('.') ?? ''
  return {
    ok: false,
    error: path ? `${path}: ${issue?.message}` : (issue?.message ?? 'achado inválido'),
  }
}

type WebSpeechBatch = {
  generatedAt: string | null
  findings: unknown[]
}

export type WebSpeechBatchParseResult =
  | { ok: true; batch: WebSpeechBatch }
  | { ok: false; error: string }

/**
 * Envelope only: the findings stay raw so one invalid entry becomes a failure
 * of that entry in the report instead of killing the whole batch.
 */
export const parseWebSpeechBatch = (value: unknown): WebSpeechBatchParseResult => {
  const envelope = z
    .object({
      generatedAt: z.string().trim().min(1).optional(),
      findings: z.array(z.unknown()),
    })
    .safeParse(value)
  if (!envelope.success) {
    return { ok: false, error: 'lote inválido: esperado { generatedAt?, findings: [...] }.' }
  }
  return {
    ok: true,
    batch: {
      generatedAt: envelope.data.generatedAt ?? null,
      findings: envelope.data.findings,
    },
  }
}
