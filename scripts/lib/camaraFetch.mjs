/**
 * HTTP surface shared by the Câmara speech scripts (C152 pilot + C153 import):
 * the open-data endpoints, the anti-crawl browser UA, bounded retry, the async
 * VOD poll and the Deep Infra transcription call. Kept apart from
 * `camaraSpeeches.mjs` (pure) so the fragile rules stay unit-testable without
 * network.
 */
import {
  buildOfficialPdfUrl,
  buildVodUrl,
  CAMARA_USER_AGENT,
  DEEPINFRA_TRANSCRIBE_URL,
  DEEPINFRA_WHISPER_MODEL,
  normalizeTranscription,
  parseDirectOfficialPdfUrl,
  parseLegacyOfficialUrl,
  parseMontaPdfUrl,
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

/**
 * Pagination-grade GET: the open-data API throws transient 500s and hangs on
 * deep pages (seen 2026-09-13 on the 55ª page 4), and `getText`'s own 3
 * attempts are too impatient for a 1.011-speech backfill. Bounded backoff;
 * the caller owns the failure policy (the import aborts only the legislature).
 *
 * @param {string} url
 * @param {{ attempts?: number, timeoutMs?: number, label?: string }} [options]
 */
export async function getJsonWithBackoff(
  url,
  { attempts = 5, timeoutMs = 45_000, label = 'camara' } = {},
) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return JSON.parse(await getText(url, { attempts: 1, timeoutMs }))
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        const waitMs = Math.min(30_000, 2 ** attempt * 1_000)
        console.log(
          `[${label}] ${error?.message ?? error} — retry ${attempt}/${attempts - 1} em ${waitMs / 1000}s`,
        )
        await sleep(waitMs)
      }
    }
  }
  throw lastError
}

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

/**
 * Lightweight reachability probe of one stored Câmara link (C155 VOD sample
 * check + C160 official-PDF check): GET with a 1 KiB `Range` so the body never
 * streams, falling back to HEAD when the server refuses the ranged GET
 * (405/501). One retry absorbs the CDN's transient connection resets; it never
 * throws — a network error becomes an `ok: false` result so one dead link
 * cannot abort the report.
 *
 * @param {string | null | undefined} url
 * @param {{ timeoutMs?: number, attempts?: number }} [options]
 * @returns {Promise<{ url: string | null, status: number | null, contentType: string | null, ok: boolean, note: string }>}
 */
export async function probeLink(url, { timeoutMs = 20_000, attempts = 2 } = {}) {
  if (!url) return { url: null, status: null, contentType: null, ok: false, note: 'sem link' }

  const request = async (method) => {
    const response = await fetch(url, {
      method,
      headers: {
        'User-Agent': CAMARA_USER_AGENT,
        ...(method === 'GET' ? { Range: 'bytes=0-1023' } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const contentType = response.headers.get('content-type')
    const note = `HTTP ${response.status}${contentType ? ` ${contentType}` : ''}`
    await response.body?.cancel().catch(() => undefined)
    return { url, status: response.status, contentType, ok: response.ok, note }
  }

  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const first = await request('GET')
      if (first.status === 405 || first.status === 501) return await request('HEAD')
      return first
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(1_000)
    }
  }
  return {
    url,
    status: null,
    contentType: null,
    ok: false,
    note: lastError?.message ?? String(lastError),
  }
}

/**
 * Follows the legacy Diário visualizer redirect to the direct PDF (C160). The
 * chain measured on 2026-09-14: `dc_20b.asp` 302 → `montaPdf.asp?narquivo=…`
 * (~5s on `.leg.br`; the `.gov.br` host adds a slow ~135s hop, so the lookup
 * starts at `.leg.br`), and `response.url` is the `montaPdf` URL carrying
 * `narquivo`/`npagina` — no HTML parsing. Fails closed when the chain does not
 * land on a Câmara `montaPdf`/PDF URL.
 *
 * @param {string} legacyUrl
 * @param {{ timeoutMs?: number, attempts?: number }} [options]
 * @returns {Promise<{ archiveFileName: string, page: number | null, pdfUrl: string, finalUrl: string }>}
 */
export async function resolveOfficialPdfUrl(legacyUrl, { timeoutMs = 180_000, attempts = 2 } = {}) {
  const parsedLookup = parseLegacyOfficialUrl(legacyUrl)
  if (!parsedLookup) throw new Error(`link oficial não reconhecido: ${String(legacyUrl ?? '')}`)
  const lookupUrl = parsedLookup.lookupUrl

  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(lookupUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': CAMARA_USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      })
      const finalUrl = response.url
      await response.body?.cancel().catch(() => undefined)
      if (!response.ok) throw new Error(`HTTP ${response.status} em ${lookupUrl}`)

      const parsed = parseMontaPdfUrl(finalUrl) ?? parseDirectOfficialPdfUrl(finalUrl)
      if (!parsed) throw new Error(`redirect final inesperado em ${finalUrl}`)
      return {
        ...parsed,
        pdfUrl: buildOfficialPdfUrl(parsed.archiveFileName, parsed.page),
        finalUrl,
      }
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(3_000)
    }
  }
  throw lastError
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
