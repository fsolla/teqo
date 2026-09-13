/**
 * HTTP surface shared by the Câmara speech scripts (C152 pilot + C153 import):
 * the open-data endpoints, the anti-crawl browser UA, bounded retry, the async
 * VOD poll and the Deep Infra transcription call. Kept apart from
 * `camaraSpeeches.mjs` (pure) so the fragile rules stay unit-testable without
 * network.
 */
import {
  buildVodUrl,
  CAMARA_USER_AGENT,
  DEEPINFRA_TRANSCRIBE_URL,
  DEEPINFRA_WHISPER_MODEL,
  normalizeTranscription,
  parseVodStatus,
} from './camaraSpeeches.mjs'

const camaraHeaders = { 'User-Agent': CAMARA_USER_AGENT, Accept: 'application/json' }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchOnce(url, { timeoutMs = 30_000, headers = camaraHeaders } = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`)
  return response
}

/** The Câmara API drops connections now and then — bounded retry for GETs. */
export async function getText(url, { attempts = 3, ...options } = {}) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await (await fetchOnce(url, options)).text()
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(2_000)
    }
  }
  throw lastError
}

export const getJson = async (url, options) => JSON.parse(await getText(url, options))

export const downloadToBuffer = async (url, { attempts = 3, timeoutMs = 120_000 } = {}) => {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchOnce(url, {
        timeoutMs,
        headers: { 'User-Agent': CAMARA_USER_AGENT },
      })
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(3_000)
    }
  }
  throw lastError
}

export const speechesUrl = (deputyId, from, to) =>
  `https://dadosabertos.camara.leg.br/api/v2/deputados/${deputyId}/discursos` +
  `?dataInicio=${from}&dataFim=${to}&itens=100&ordenarPor=dataHoraInicio&ordem=ASC`

export const eventsUrl = (date) =>
  `https://dadosabertos.camara.leg.br/api/v2/eventos?dataInicio=${date}&dataFim=${date}&itens=100`

export const eventPageUrl = (eventId) => `https://www.camara.leg.br/evento-legislativo/${eventId}`

const VOD_POLL_INTERVAL_MS = 5_000
const VOD_POLL_MAX_ATTEMPTS = 40

/** Polls the async VOD generation until PRONTO (or gives up). */
export async function resolveVod(eventId, excerpt) {
  const url = buildVodUrl(eventId, excerpt.audioId, excerpt.tMs)
  let lastStatus = null
  for (let attempt = 1; attempt <= VOD_POLL_MAX_ATTEMPTS; attempt += 1) {
    const status = parseVodStatus(await getJson(url, { timeoutMs: 60_000 }))
    lastStatus = status
    if (status.state === 'PRONTO' || status.state === 'INDISPONIVEL') {
      return { url, status, attempts: attempt }
    }
    await sleep(VOD_POLL_INTERVAL_MS)
  }
  return { url, status: lastStatus, attempts: VOD_POLL_MAX_ATTEMPTS }
}

export const DEEPINFRA_COST_PER_MINUTE_USD = 0.00045

/**
 * Sends the excerpt MP4 (video/mp4 is accepted; no ffmpeg) to Deep Infra's
 * OpenAI-compatible endpoint and returns the normalized transcription.
 * Throws on missing key or provider error — the caller owns the failure policy.
 */
export async function transcribeSpeechAudio(buffer) {
  const apiKey = process.env.DEEPINFRA_API_KEY
  if (!apiKey) {
    throw new Error('DEEPINFRA_API_KEY ausente — configure no .env.local ou no env do processo.')
  }
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'video/mp4' }), 'trecho.mp4')
  form.append('model', DEEPINFRA_WHISPER_MODEL)
  form.append('language', 'pt')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  const startedAt = Date.now()
  const response = await fetch(DEEPINFRA_TRANSCRIBE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(600_000),
  })
  if (!response.ok) {
    throw new Error(`Deep Infra HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  }
  return {
    transcription: normalizeTranscription(await response.json()),
    elapsedMs: Date.now() - startedAt,
  }
}
