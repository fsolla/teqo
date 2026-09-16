import 'server-only'

import {
  buildVodUrl,
  CAMARA_USER_AGENT,
  parseVodStatus,
  type CamaraVodStatus,
  type SpeechVodResolution,
} from '@/lib/speechVod'

/**
 * C162/C169 — interactive VOD resolution for the acervo detail. Deliberately
 * NOT a reuse of `scripts/lib/camaraFetch.mjs` (whose `resolveVod` polls for
 * ~200s and whose `probeLink` reports instead of deciding): whoever calls this
 * owns the wait budget through a `SpeechVodPolicy`, and the media verification
 * (not the policy) decides what may reach the browser.
 *
 * The player keeps a short click budget of its own (`SPEECH_VOD_PLAYER_POLICY`;
 * C181 widened it to poll a transcode in progress) and stops before the cut
 * job's window; the cut job (C169) needs the measured first-request window
 * (~30s, then short polls) plus the stored links as a last verified candidate,
 * and passes `SPEECH_VOD_CUT_POLICY` + `cachedUrls`.
 */

export type SpeechVodPolicy = {
  /** Abort timeout of each `video-sob-demanda` read. */
  statusTimeoutMs: number
  /** Extra reads after a transport failure (total attempts = 1 + retries). */
  statusRetries: number
  /** Delay before retrying a transport failure. */
  retryDelayMs: number
  /** Extra reads after a `GERANDO` answer (the Câmara only transcodes once). */
  pollAttempts: number
  /** Delay between `GERANDO` polls. */
  pollDelayMs: number
}

/**
 * C181's player click: a short, own budget that waits out the Câmara's
 * transcoding instead of treating the first `GERANDO` as a failure — 1 read +
 * 2 polls of 3 s (~6 s extra), between the old immediate answer and the cut
 * job's budget (a 45 s read timeout plus 2 polls of 5 s). The wait stays
 * bounded; past it the honest "gerando" state and the retry remain.
 */
export const SPEECH_VOD_PLAYER_POLICY: SpeechVodPolicy = {
  statusTimeoutMs: 15_000,
  statusRetries: 1,
  retryDelayMs: 1_000,
  pollAttempts: 2,
  pollDelayMs: 3_000,
}

/** C169's cut job: covers the measured ~30s first request and 1–2 short polls. */
export const SPEECH_VOD_CUT_POLICY: SpeechVodPolicy = {
  statusTimeoutMs: 45_000,
  statusRetries: 1,
  retryDelayMs: 1_000,
  pollAttempts: 2,
  pollDelayMs: 5_000,
}

/** Stored links of the speech, tried (and probed) only after the API fails. */
export type SpeechVodCachedUrls = {
  playbackUrl?: string | null
  downloadUrl?: string | null
}

const MEDIA_PROBE_TIMEOUT_MS = 10_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** One bounded read of the `video-sob-demanda` JSON; throws after the retries. */
const fetchVodStatus = async (url: string, policy: SpeechVodPolicy): Promise<CamaraVodStatus> => {
  let lastError: unknown
  const attempts = policy.statusRetries + 1
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': CAMARA_USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(policy.statusTimeoutMs),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`)
      return parseVodStatus(await response.json())
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(policy.retryDelayMs)
    }
  }
  throw lastError
}

type MediaProbe = { verified: boolean; retryWithHead: boolean }

/**
 * A media link counts as verified when the ranged GET answers 2xx with a real
 * content type — a `text/html` body is the CDN's error page wearing a 200.
 */
const probeMediaOnce = async (url: string, method: 'GET' | 'HEAD'): Promise<MediaProbe> => {
  const response = await fetch(url, {
    method,
    headers: {
      'User-Agent': CAMARA_USER_AGENT,
      ...(method === 'GET' ? { Range: 'bytes=0-1023' } : {}),
    },
    signal: AbortSignal.timeout(MEDIA_PROBE_TIMEOUT_MS),
  })
  const contentType = response.headers.get('content-type')
  const verified = response.ok && contentType !== null && !contentType.includes('text/html')
  await response.body?.cancel().catch(() => undefined)
  return { verified, retryWithHead: response.status === 405 || response.status === 501 }
}

/** Never throws: a transport failure is just an unverified link. */
const probeSpeechMedia = async (url: string | null): Promise<boolean> => {
  if (!url) return false
  try {
    const first = await probeMediaOnce(url, 'GET')
    if (first.verified) return true
    if (first.retryWithHead) return (await probeMediaOnce(url, 'HEAD')).verified
    return false
  } catch {
    return false
  }
}

type SpeechVodCoordinates = {
  eventId: number
  audioId: number
  excerptTms: number
}

/**
 * Probes a pair of candidate URLs in parallel and keeps only the ones whose
 * probe verified a real media body — a dead hash and the CDN's HTML error page
 * both come out as null.
 */
const probeUrls = async (
  playbackUrl: string | null,
  downloadUrl: string | null,
): Promise<SpeechVodResolution> => {
  const [playback, download] = await Promise.all([
    probeSpeechMedia(playbackUrl),
    probeSpeechMedia(downloadUrl),
  ])

  return {
    state: 'pronto',
    playbackUrl: playback ? playbackUrl : null,
    downloadUrl: download ? downloadUrl : null,
  }
}

const hasVerifiedUrl = (resolution: SpeechVodResolution): boolean =>
  resolution.state === 'pronto' &&
  (resolution.playbackUrl !== null || resolution.downloadUrl !== null)

/** The stored links, probed like the API URLs; null when none verifies. */
const fallbackToCachedUrls = async (
  cachedUrls: SpeechVodCachedUrls,
): Promise<SpeechVodResolution | null> => {
  const cached = await probeUrls(cachedUrls.playbackUrl ?? null, cachedUrls.downloadUrl ?? null)
  return hasVerifiedUrl(cached) ? cached : null
}

/** The API answer: polls `GERANDO` while the budget lasts, probes what is PRONTO. */
const resolveFromVodApi = async (
  { eventId, audioId, excerptTms }: SpeechVodCoordinates,
  policy: SpeechVodPolicy,
): Promise<SpeechVodResolution> => {
  const url = buildVodUrl(eventId, audioId, excerptTms)
  let status = await fetchVodStatus(url, policy)
  for (let poll = 0; status.state === 'GERANDO' && poll < policy.pollAttempts; poll += 1) {
    await sleep(policy.pollDelayMs)
    status = await fetchVodStatus(url, policy)
  }

  if (status.state === 'GERANDO') return { state: 'gerando' }
  if (status.state !== 'PRONTO' || !status.video) return { state: 'indisponivel' }

  return probeUrls(status.video.playbackUrl, status.video.downloadUrl)
}

/**
 * Resolves one excerpt: the Câmara API first (polls while it says `GERANDO`),
 * then — when the caller passed `cachedUrls` and the API left no verified URL
 * — the links already stored on the speech. Without `cachedUrls` the C162
 * behavior is preserved down to the transport error rethrown to the caller.
 */
export const resolveSpeechVod = async (
  coordinates: SpeechVodCoordinates,
  options: { policy?: SpeechVodPolicy; cachedUrls?: SpeechVodCachedUrls } = {},
): Promise<SpeechVodResolution> => {
  const { policy = SPEECH_VOD_PLAYER_POLICY, cachedUrls } = options

  let resolution: SpeechVodResolution
  try {
    resolution = await resolveFromVodApi(coordinates, policy)
  } catch (error) {
    if (!cachedUrls) throw error
    const cached = await fallbackToCachedUrls(cachedUrls)
    if (cached) return cached
    throw error
  }

  if (cachedUrls && !hasVerifiedUrl(resolution)) {
    const cached = await fallbackToCachedUrls(cachedUrls)
    if (cached) return cached
  }

  return resolution
}
