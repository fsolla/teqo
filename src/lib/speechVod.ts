/**
 * Pure VOD rules shared by the Câmara speech scripts (C152 pilot/C153 import)
 * and the acervo player (C162): the `video-sob-demanda` URL/status contract,
 * the crawl UA, the session-offset math and the YouTube video id.
 *
 * No I/O here — the scripts and the server resolver own the fetch/timeout
 * policy, so the fragile rules stay unit-testable without network.
 */

/** Browser-like UA — the trecho/evento pages answer 400 "Acesso via bot" to curl. */
export const CAMARA_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

/** The async VOD-generation status URL for one excerpt. */
export const buildVodUrl = (eventId: number, audioId: number, tMs: number): string =>
  `https://www.camara.leg.br/evento-legislativo/${eventId}/video-sob-demanda?idAudio=${audioId}&trecho=${tMs}`

type CamaraVodVideo = {
  title: string | null
  subtitle: string | null
  duration: string | null
  clock: string | null
  downloadUrl: string | null
  playbackUrl: string | null
}

export type CamaraVodStatus = {
  state: string
  video: CamaraVodVideo | null
}

/**
 * What the acervo player can do after asking the Câmara about one excerpt:
 * `pronto` carries only URLs that passed the media probe (either can still be
 * null when its own probe failed), `gerando` means the server is transcoding,
 * `indisponivel` means there is nothing usable.
 */
export type SpeechVodResolution =
  | { state: 'pronto'; playbackUrl: string | null; downloadUrl: string | null }
  | { state: 'gerando' }
  | { state: 'indisponivel' }

export type SpeechVodCoordinatesSource = {
  vodPlaybackUrl?: string | null
  vodDownloadUrl?: string | null
  eventId?: number | null
  audioId?: number | null
  excerptTMs?: number | null
}

/**
 * The Câmara coordinates of a speech whose excerpt can be re-resolved: a
 * stored VOD link (eligibility signal only — it is a cache and never a URL
 * handed to the browser) plus `eventId`/`audioId`/`excerptTMs`. Null means the
 * player must not offer the resolution; the view model and the action share
 * this one decision.
 */
export const speechVodCoordinates = (
  speech: SpeechVodCoordinatesSource,
): { eventId: number; audioId: number; excerptTms: number } | null => {
  const hasStoredVod = Boolean(speech.vodPlaybackUrl || speech.vodDownloadUrl)
  const { eventId, audioId, excerptTMs } = speech
  if (!hasStoredVod || !eventId || !audioId || !excerptTMs) return null
  return { eventId, audioId, excerptTms: excerptTMs }
}

/**
 * Normalizes the `video-sob-demanda` JSON (`{ estado, video }`). `state` is
 * `GERANDO` while the server transcodes, `PRONTO` when the MP4 exists,
 * `INDISPONIVEL` when there is none.
 */
export const parseVodStatus = (json: unknown): CamaraVodStatus => {
  const data = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
  const estado = typeof data.estado === 'string' ? data.estado : 'DESCONHECIDO'
  const raw =
    data.video && typeof data.video === 'object' ? (data.video as Record<string, unknown>) : null
  const pick = (key: string): string | null =>
    typeof raw?.[key] === 'string' ? (raw[key] as string) : null
  return {
    state: estado,
    video: raw
      ? {
          title: pick('titulo'),
          subtitle: pick('subtitulo'),
          duration: pick('duracao'),
          clock: pick('horario'),
          downloadUrl: pick('linkParaDownload'),
          playbackUrl: pick('linkParaReproducao'),
        }
      : null,
  }
}

/**
 * Parses the Câmara duration spellings into seconds: `0h04'03"` (excerpt card)
 * and `0:04:07` / `4:07` (VOD status). Null when unparseable.
 */
export const parseDurationToSeconds = (value: unknown): number | null => {
  const raw = String(value ?? '').trim()
  if (raw === '') return null

  const card = /^(\d+)h(\d{1,2})'(\d{1,2})"?$/.exec(raw)
  if (card) {
    const minutes = Number(card[2])
    const seconds = Number(card[3])
    if (minutes > 59 || seconds > 59) return null
    return Number(card[1]) * 3600 + minutes * 60 + seconds
  }

  const parts = raw.split(':')
  if (!parts.every((part) => /^\d{1,2}$/.test(part))) return null
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(Number)
    if (minutes > 59 || seconds > 59) return null
    return hours * 3600 + minutes * 60 + seconds
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts.map(Number)
    if (seconds > 59) return null
    return minutes * 60 + seconds
  }
  return null
}

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/
const YOUTUBE_HOSTS = new Set(['youtube.com', 'youtube-nocookie.com', 'youtu.be'])
const YOUTUBE_ID_PATH_PREFIXES = new Set(['embed', 'live', 'shorts', 'v'])

/**
 * YouTube video id of an `urlRegistro` link, or null when the URL is not a
 * recognized YouTube form (`watch?v=`, `youtu.be/<id>`, `embed`/`live`/
 * `shorts`/`v`) or the id does not look like one. Defensive on purpose: the
 * open-data field varies, and a null simply falls back to the VOD path.
 */
export const parseYoutubeVideoId = (raw: unknown): string | null => {
  const value = String(raw ?? '').trim()
  if (value === '') return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '')
  if (!YOUTUBE_HOSTS.has(host)) return null

  const segments = url.pathname.split('/').filter(Boolean)
  let candidate: string | null = null
  if (host === 'youtu.be') {
    candidate = segments[0] ?? null
  } else if (segments[0] === 'watch') {
    candidate = url.searchParams.get('v')
  } else if (segments[0] && YOUTUBE_ID_PATH_PREFIXES.has(segments[0])) {
    candidate = segments[1] ?? null
  }

  return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null
}

/**
 * The YouTube default cover (C175) of an already-parsed video id, or null when
 * there is none. `hqdefault` is the variant the whole repo uses; `object-cover`
 * crops the 4:3 letterbox bars the YouTube player frame adds to 16:9 video.
 */
export const youtubeThumbnailUrl = (videoId: string | null): string | null =>
  videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo'
const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
const brtWallClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** JavaScript Date range: ±100,000,000 days from the epoch. */
const MAX_DATE_MS = 8.64e15

/** BRT wall-clock of a valid epoch instant, as seconds since epoch-as-UTC. */
const wallClockSeconds = (epochMs: number): number => {
  const parts = brtWallClock.formatToParts(new Date(epochMs))
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value)
  return (
    Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second'),
    ) / 1000
  )
}

/** BRT wall-clock seconds-since-epoch of a naive Câmara datetime, or null. */
const naiveWallClockSeconds = (value: unknown): number | null => {
  const match = NAIVE_DATETIME.exec(String(value ?? '').trim())
  if (!match) return null
  const [, year, month, day, hour, minute, second = '0'] = match
  const [y, mo, d, h, mi, s] = [year, month, day, hour, minute, second].map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) {
    return null
  }
  const ms = Date.UTC(y, mo - 1, d, h, mi, s)
  const date = new Date(ms)
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null
  }
  return ms / 1000
}

/**
 * Seconds from the session start (`eventStartAt`, naive Câmara wall clock) to
 * the excerpt (`excerptTMs`, epoch ms). Both sides are read as BRT wall clock,
 * so a session crossing midnight still measures the right distance. Null when
 * either side is unparseable or the excerpt precedes the session start.
 */
export const excerptOffsetSeconds = (excerptTMs: unknown, eventStartAt: unknown): number | null => {
  const epochMs = Number(excerptTMs)
  if (!Number.isFinite(epochMs) || epochMs <= 0 || epochMs > MAX_DATE_MS) return null

  const startSeconds = naiveWallClockSeconds(eventStartAt)
  if (startSeconds === null) return null

  const offset = Math.floor(wallClockSeconds(epochMs) - startSeconds)
  return offset >= 0 ? offset : null
}

/**
 * Measured start delay of a session video, in seconds: how long after the
 * session's declared start (`eventStartAt`) the recording actually begins.
 * The archive cannot begin after the broadcast went live, so the anchor the
 * player resolves from the YouTube API is only an upper bound — a lag measured
 * against the video itself is exact and wins. Keyed by `videoId`: the delay
 * belongs to the recording, never to a single speech. Evidence is dated; never
 * overwrite an entry without a new measurement.
 */
const MEASURED_VIDEO_LAG_SECONDS: ReadonlyMap<string, number> = new Map([
  // Fala 997 (C172, Issue #1082, 2026-09-16): app opened at 11962s, the
  // YouTube share of the same point at 11949s.
  ['DC_i9Kp1LVk', 13],
  // Fala 641 (C163, 2026-09-15): the 2018-03-13 session video starts ~37s
  // after `eventStartAt` (checked in the browser at t=608s).
  ['2cX_gKkJH7Q', 37],
  // Fala 981 (staging, 2026-09-16): app opened at 25156s, the YouTube share of
  // the same point at 25125s (session of 2026-06-16).
  ['hAUJ3fXgsIQ', 31],
  // Fala 973 (staging, 2026-09-16): app opened at 392s, the YouTube share of
  // the same point at ~382s (session of 2026-05-27; measurement approximate).
  ['hZ9Yl4MFHQs', 10],
  // Staging (2026-09-16): app opened at 11622s, the YouTube share of the same
  // point at ~11533s (session of 2026-06-17; measurement approximate).
  ['nHHqPaJEERI', 89],
])

/**
 * A gap beyond this is not the session's own start delay, it is a URL that
 * belongs to another session — treat the anchor as unknown (fail-closed).
 */
const MAX_SESSION_LAG_SECONDS = 3600

/**
 * Measured lag of a session video, or null when this recording was never
 * measured — the caller then falls back to the API anchor.
 */
export const measuredVideoLagSeconds = (videoId: string | null): number | null =>
  videoId === null ? null : (MEASURED_VIDEO_LAG_SECONDS.get(videoId) ?? null)

/**
 * Seconds between the session's declared start (`eventStartAt`, naive Câmara
 * wall clock) and the moment the video itself starts (`videoStartAt`, ISO with
 * zone — YouTube's `actualStartTime`). Both sides are read as BRT wall clock,
 * like `excerptOffsetSeconds`. Null when either side is unparseable, when the
 * video does not start after the declared slot (the excerpt offset is already
 * early — nothing to correct) or when the gap is implausibly large.
 */
export const sessionLagSeconds = (videoStartAt: unknown, eventStartAt: unknown): number | null => {
  const startMs = Date.parse(String(videoStartAt ?? '').trim())
  if (!Number.isFinite(startMs) || startMs <= 0 || startMs > MAX_DATE_MS) return null

  const startSeconds = naiveWallClockSeconds(eventStartAt)
  if (startSeconds === null) return null

  const lag = Math.floor(wallClockSeconds(startMs) - startSeconds)
  return lag > 0 && lag <= MAX_SESSION_LAG_SECONDS ? lag : null
}

/**
 * The session offset of an excerpt, moved from the declared session start to
 * the video's own start: the second a YouTube player must open. A null lag
 * keeps the offset as-is (today's behaviour, never a guess).
 */
export const correctedExcerptOffsetSeconds = (
  excerptOffset: number | null,
  lagSeconds: number | null,
): number | null => {
  if (excerptOffset === null) return null
  if (lagSeconds === null) return excerptOffset
  return Math.max(0, excerptOffset - lagSeconds)
}
