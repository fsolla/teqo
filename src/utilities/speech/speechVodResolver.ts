import 'server-only'

import {
  buildVodUrl,
  CAMARA_USER_AGENT,
  parseVodStatus,
  type SpeechVodResolution,
} from '@/lib/speechVod'

/**
 * C162 — interactive VOD resolution for the acervo detail. Deliberately NOT a
 * reuse of `scripts/lib/camaraFetch.mjs` (whose `resolveVod` polls for ~200s
 * and whose `probeLink` reports instead of deciding): the player's contract is
 * a bounded click, so this module owns its own short retry, timeout and the
 * media verification that decides what may reach the browser.
 */

const VOD_STATUS_ATTEMPTS = 2
const VOD_STATUS_TIMEOUT_MS = 15_000
const VOD_STATUS_RETRY_DELAY_MS = 1_000
const MEDIA_PROBE_TIMEOUT_MS = 10_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** One bounded fetch of the `video-sob-demanda` JSON; throws after the retries. */
const fetchVodStatus = async (url: string): Promise<unknown> => {
  let lastError: unknown
  for (let attempt = 1; attempt <= VOD_STATUS_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': CAMARA_USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(VOD_STATUS_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`)
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < VOD_STATUS_ATTEMPTS) await sleep(VOD_STATUS_RETRY_DELAY_MS)
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

export const resolveSpeechVod = async ({
  eventId,
  audioId,
  excerptTms,
}: {
  eventId: number
  audioId: number
  excerptTms: number
}): Promise<SpeechVodResolution> => {
  const status = parseVodStatus(await fetchVodStatus(buildVodUrl(eventId, audioId, excerptTms)))

  if (status.state === 'GERANDO') return { state: 'gerando' }
  if (status.state !== 'PRONTO' || !status.video) return { state: 'indisponivel' }

  const [playback, download] = await Promise.all([
    probeSpeechMedia(status.video.playbackUrl),
    probeSpeechMedia(status.video.downloadUrl),
  ])

  return {
    state: 'pronto',
    playbackUrl: playback ? status.video.playbackUrl : null,
    downloadUrl: download ? status.video.downloadUrl : null,
  }
}
