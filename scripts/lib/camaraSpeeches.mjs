/**
 * Pure derivation for the Câmara speech scripts — the C152 pilot
 * (`scripts/pilot-camara-speeches.mjs`) and the C153 catalog import
 * (`scripts/import-camara-speeches.mjs`): matching a Câmara speech to its
 * legislative event and to the speaker's video excerpt, the presiding-officer
 * transitions, plus normalizing the VOD status and the Deep Infra transcription.
 *
 * No I/O here — the CLI threads fetch/download/transcribe through these
 * decisions, so the fragile rules (HTML anchors, time-of-day matching, epoch
 * offsets, provider shapes) are unit-tested without network.
 */
import { createHash } from 'node:crypto'

/** Câmara's open-data deputy id for Jorge Solla (used by the pilot). */
export const SOLLA_DEPUTY_ID = 178857

/** Browser-like UA — the trecho/evento pages answer 400 "Acesso via bot" to curl. */
export const CAMARA_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

/** Deep Infra OpenAI-compatible transcription endpoint (returns segments with `verbose_json`). */
export const DEEPINFRA_TRANSCRIBE_URL = 'https://api.deepinfra.com/v1/openai/audio/transcriptions'

/** Whisper large-v3 on Deep Infra — US$ 0,00045/audio minute. */
export const DEEPINFRA_WHISPER_MODEL = 'openai/whisper-large-v3'

/** Legislature → inclusive date range (year of the first and last session). */
export const LEGISLATURE_RANGES = {
  54: ['2011-01-01', '2015-01-31'],
  55: ['2015-02-01', '2019-01-31'],
  56: ['2019-02-01', '2023-01-31'],
  57: ['2023-02-01', '2027-01-31'],
}

const stripAccents = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Canonical form of a speaker name for comparison: NFD-stripped, uppercase,
 * punctuation dropped, whitespace collapsed. `Jorge Solla` → `JORGE SOLLA`.
 *
 * @param {string} name
 * @returns {string}
 */
export const normalizeSpeakerName = (name) =>
  stripAccents(String(name ?? ''))
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * `HH:MM` / `HH:MM:SS` → seconds of day, or null when unparseable.
 *
 * @param {string} clock
 * @returns {number | null}
 */
export const clockToSeconds = (clock) => {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(clock ?? '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? '0')
  if (hours > 23 || minutes > 59 || seconds > 59) return null
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Time-of-day (seconds) of a naive local datetime (`2023-02-07T17:28`).
 * Returns null when the value has no `T`-time part.
 *
 * @param {string} iso
 * @returns {number | null}
 */
export const speechTimeOfDaySeconds = (iso) => clockToSeconds(String(iso ?? '').slice(11, 19))

/** `YYYY-MM-DD` prefix of a naive datetime. */
export const speechDate = (iso) => String(iso ?? '').slice(0, 10)

/**
 * Stable natural key of an open-data speech. The API has no id, so identity is
 * the naive datetime plus the speech type and event phase — the record is
 * updated in place across imports (C153 idempotency). Two genuinely distinct
 * speeches can share that triple (seen on 2026-06-17T17:16, "PELA ORDEM"); the
 * importer disambiguates those with `speechContentHash`.
 *
 * @param {{ dataHoraInicio?: string, tipoDiscurso?: string, faseEvento?: { titulo?: string } } | null | undefined} speech
 * @returns {string}
 */
export const speechSourceKey = (speech) =>
  [
    String(speech?.dataHoraInicio ?? '').trim(),
    String(speech?.tipoDiscurso ?? '').trim(),
    String(speech?.faseEvento?.titulo ?? '').trim(),
  ].join('|')

/**
 * Short content hash (summary + official transcript) used to disambiguate a
 * `sourceKey` collision: the first item keeps the base key, a distinct item
 * gets `<baseKey>#<hash>` and stays stable across re-imports.
 *
 * @param {unknown} summary
 * @param {unknown} transcript
 * @returns {string}
 */
export const speechContentHash = (summary, transcript) =>
  createHash('sha256')
    .update(`${String(summary ?? '').trim()}\n${String(transcript ?? '').trim()}`)
    .digest('hex')
    .slice(0, 12)

/**
 * Official keywords: the API separates keyword GROUPS with newlines and the
 * individual keywords inside a group with commas (live data:
 * `Governo federal,reconstrução,Política pública`). Both are separators; no
 * official keyword contains a comma.
 *
 * @param {unknown} raw
 * @returns {string[]}
 */
export const parseOfficialKeywords = (raw) =>
  String(raw ?? '')
    .split(/[\r\n,]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean)

/**
 * Legislature of a `YYYY-MM-DD` date per `LEGISLATURE_RANGES`, or null when it
 * falls outside the supported range.
 *
 * @param {string} iso
 * @returns {string | null}
 */
export const legislatureForDate = (iso) => {
  const date = speechDate(iso)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  for (const [legislature, [from, to]] of Object.entries(LEGISLATURE_RANGES)) {
    if (date >= from && date <= to) return legislature
  }
  return null
}

/**
 * Parses the Câmara duration spellings into seconds: `0h04'03"` (excerpt card)
 * and `0:04:07` / `4:07` (VOD status). Null when unparseable.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
export const parseDurationToSeconds = (value) => {
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

const integerOrNull = (value) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Parses the speaker-excerpt anchors of an event page. The page renders one
 * `<a id="link-trecho-video" href="…/{eventId}?a=<idAudio>&t=<epochms>…"
 * class="chamada__link-trecho" titulo="<SPEAKER>">` per excerpt, followed by
 * the speaker card (`chamada__cargo`, `chamada__info-video-hora`,
 * `chamada__info-video-duracao`). Returns `[]` when the event has no excerpts
 * (old/committee sessions, or an unexpected layout).
 *
 * @param {string} html
 * @param {number | string} eventId
 * @returns {Array<{ audioId: number, tMs: number, speaker: string, party: string | null, startTime: string | null, duration: string | null }>}
 */
export const parseEventExcerpts = (html, eventId) => {
  const page = String(html ?? '')
  const escapedId = String(eventId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const anchor = new RegExp(
    `href="https://www\\.camara\\.leg\\.br/evento-legislativo/${escapedId}\\?a&#x3D;(\\d+)&amp;t&#x3D;(\\d+)&trechosOrador=&crawl=no"[^>]*class="chamada__link-trecho"[^>]*titulo="([^"]*)"`,
    'g',
  )

  const excerpts = []
  let match
  while ((match = anchor.exec(page)) !== null) {
    const audioId = integerOrNull(match[1])
    const tMs = integerOrNull(match[2])
    if (audioId === null || tMs === null) continue
    const boundary = page.indexOf('id="link-trecho-video"', match.index + 1)
    const end = boundary === -1 ? match.index + 4000 : Math.min(boundary, match.index + 4000)
    const chunk = page.slice(match.index, end)
    const afterDash = (text) => text.split(' - ').slice(1).join(' - ').trim() || null
    const startRaw = /class="chamada__info-video-hora">([^<]*)<\/span>/.exec(chunk)?.[1]
    const durationRaw = /class="chamada__info-video-duracao">([^<]*)<\/span>/.exec(chunk)?.[1]
    excerpts.push({
      audioId,
      tMs,
      speaker: match[3].trim(),
      party: /class="chamada__cargo">([^<]*)<\/span>/.exec(chunk)?.[1]?.trim() ?? null,
      startTime: startRaw ? afterDash(startRaw) : null,
      duration: durationRaw ? afterDash(durationRaw) : null,
    })
  }
  return excerpts
}

/** The async VOD-generation status URL for one excerpt. */
export const buildVodUrl = (eventId, audioId, tMs) =>
  `https://www.camara.leg.br/evento-legislativo/${eventId}/video-sob-demanda?idAudio=${audioId}&trecho=${tMs}`

/**
 * Normalizes the `video-sob-demanda` JSON (`{ estado, video }`). `state` is
 * `GERANDO` while the server transcodes, `PRONTO` when the MP4 exists,
 * `INDISPONIVEL` when there is none.
 *
 * @param {unknown} json
 * @returns {{ state: string, video: { title: string | null, subtitle: string | null, duration: string | null, clock: string | null, downloadUrl: string | null, playbackUrl: string | null } | null }}
 */
export const parseVodStatus = (json) => {
  const data = json && typeof json === 'object' ? json : {}
  const estado = typeof data.estado === 'string' ? data.estado : 'DESCONHECIDO'
  const raw = data.video && typeof data.video === 'object' ? data.video : null
  const pick = (key) => (typeof raw?.[key] === 'string' ? raw[key] : null)
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
 * Events of the speech's date, nearest-first by start time. The open-data
 * `uriEvento` comes empty, so the event is inferred from the date/time.
 *
 * @param {Array<{ id: number, dataHoraInicio?: string, descricaoTipo?: string, urlRegistro?: string | null }>} events
 * @param {string} speechIso
 * @returns {Array<{ id: number, dataHoraInicio?: string, descricaoTipo?: string, urlRegistro?: string | null }>}
 */
export const selectSpeechEvents = (events, speechIso) => {
  const date = speechDate(speechIso)
  const target = Date.parse(speechIso)
  return (Array.isArray(events) ? events : [])
    .filter((event) => speechDate(event?.dataHoraInicio) === date)
    .sort((a, b) => {
      const da = Math.abs(Date.parse(a.dataHoraInicio) - target)
      const db = Math.abs(Date.parse(b.dataHoraInicio) - target)
      return da - db
    })
}

/**
 * Picks the speaker's excerpt nearest in time-of-day to the speech. Returns
 * null when the speaker is empty or does not appear on the page. Excerpts
 * without a clock lose to ones with a clock.
 *
 * @param {ReturnType<typeof parseEventExcerpts>} excerpts
 * @param {string} speechIso
 * @param {string} speaker
 * @returns {(ReturnType<typeof parseEventExcerpts>[number]) | null}
 */
export const matchExcerpt = (excerpts, speechIso, speaker) => {
  const wanted = normalizeSpeakerName(speaker)
  if (wanted === '') return null
  const bySpeaker = (Array.isArray(excerpts) ? excerpts : []).filter((excerpt) =>
    normalizeSpeakerName(excerpt?.speaker).includes(wanted),
  )
  if (bySpeaker.length === 0) return null
  const target = speechTimeOfDaySeconds(speechIso)
  if (target === null) return bySpeaker[0]
  const delta = (excerpt) => {
    const start = clockToSeconds(excerpt.startTime)
    return start === null ? Number.POSITIVE_INFINITY : Math.abs(start - target)
  }
  return bySpeaker.reduce((best, current) => (delta(current) < delta(best) ? current : best))
}

/**
 * Parses the "Troca da mesa" transition groups of an event page. Each heading
 * `<h4 class="g-l-assista__categoria-outros-videos">Troca da mesa Presidente X
 * por Participante Y</h4>` labels the excerpt cards that follow it; the newest
 * card of the group (`t` epoch ms) marks the observed moment of the change.
 * Returns transitions ascending by time; `[]` when the layout changed or the
 * page recorded none.
 *
 * @param {string} html
 * @returns {Array<{ from: string, to: string, tMs: number }>}
 */
export const parsePresidingOfficerTransitions = (html) => {
  const page = String(html ?? '')
  const headingPattern =
    /<h4 class="g-l-assista__categoria-outros-videos">Troca da mesa Presidente (.+?) por Participante (.+?)<\/h4>/g
  const transitions = []
  let heading
  while ((heading = headingPattern.exec(page)) !== null) {
    const nextHeading = page.indexOf(
      'g-l-assista__categoria-outros-videos',
      headingPattern.lastIndex,
    )
    const group = page.slice(heading.index, nextHeading === -1 ? page.length : nextHeading)
    const times = [...group.matchAll(/<a id="link-trecho-video" href="[^"]*?t&#x3D;(\d+)[^"]*"/g)]
      .map((match) => Number(match[1]))
      .filter((value) => Number.isInteger(value) && value > 0)
    if (times.length === 0) continue
    transitions.push({
      from: heading[1].trim(),
      to: heading[2].trim(),
      tMs: Math.max(...times),
    })
  }
  return transitions.sort((left, right) => left.tMs - right.tMs)
}

/**
 * Who presided at `tMs` according to the transition groups: the incoming
 * officer (`to`) of the latest transition at or before the moment; before the
 * first transition, the outgoing officer (`from`) of the earliest one. Returns
 * null when the page recorded no transitions (unknown, never invented).
 *
 * @param {ReturnType<typeof parsePresidingOfficerTransitions>} transitions
 * @param {number} tMs
 * @returns {string | null}
 */
export const resolvePresidingOfficer = (transitions, tMs) => {
  const ordered = (Array.isArray(transitions) ? transitions : [])
    .filter((transition) => Number.isFinite(transition?.tMs))
    .sort((left, right) => left.tMs - right.tMs)
  const target = Number(tMs)
  if (ordered.length === 0 || !Number.isFinite(target)) return null

  let current = ordered[0].from
  for (const transition of ordered) {
    if (transition.tMs > target) break
    current = transition.to
  }
  return current
}

/**
 * Normalizes a Deep Infra transcription response. Accepts the OpenAI-compat
 * shape (`segments[{start,end,text}]`) and the native whisper shape
 * (`chunks[{timestamp:[start,end],text}]`). Invalid entries are dropped.
 *
 * @param {unknown} json
 * @returns {{ text: string, language: string | null, duration: number | null, segments: Array<{ start: number, end: number, text: string }> }}
 */
export const normalizeTranscription = (json) => {
  const data = json && typeof json === 'object' ? json : {}
  const rawSegments = Array.isArray(data.segments)
    ? data.segments
    : Array.isArray(data.chunks)
      ? data.chunks
      : []
  const segments = rawSegments
    .map((segment) => {
      const timestamps = Array.isArray(segment?.timestamp) ? segment.timestamp : null
      const rawStart = segment?.start ?? timestamps?.[0]
      const rawEnd = segment?.end ?? timestamps?.[1]
      const start = rawStart === null || rawStart === undefined ? Number.NaN : Number(rawStart)
      const end = rawEnd === null || rawEnd === undefined ? Number.NaN : Number(rawEnd)
      const text = typeof segment?.text === 'string' ? segment.text.trim() : ''
      return { start, end, text }
    })
    .filter(
      (segment) =>
        Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.text !== '',
    )
  return {
    text: typeof data.text === 'string' ? data.text.trim() : segments.map((s) => s.text).join(' '),
    language: typeof data.language === 'string' ? data.language : null,
    duration:
      typeof data.duration === 'number' && Number.isFinite(data.duration) ? data.duration : null,
    segments,
  }
}

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value))

/**
 * Splits an inclusive `YYYY-MM-DD` range into calendar chunks (no overlap;
 * first/last partial) at `unit` granularity. The backfill fallback uses it
 * when the API refuses a deep page: a shallow per-year listing still recovers
 * the years the broken offset does not cover, and a broken year is isolated
 * down to the month.
 *
 * @param {string} from
 * @param {string} to
 * @param {'year' | 'month'} unit
 * @returns {Array<[string, string]>}
 */
export const dateRangeChunks = (from, to, unit = 'year') => {
  const chunks = []
  if (!isIsoDate(from) || !isIsoDate(to)) return chunks
  let start = String(from)
  while (start <= String(to)) {
    const end =
      unit === 'month'
        ? `${start.slice(0, 7)}-${String(
            new Date(
              Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0),
            ).getUTCDate(),
          ).padStart(2, '0')}`
        : `${start.slice(0, 4)}-12-31`
    const boundedEnd = end < String(to) ? end : String(to)
    chunks.push([start, boundedEnd])
    const next = new Date(`${boundedEnd}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    start = next.toISOString().slice(0, 10)
  }
  return chunks
}

/** Numeric blocks of one run that `aggregateBackfillRuns` folds together. */
const BACKFILL_TOTAL_KEYS = [
  'listed',
  'processed',
  'created',
  'updated',
  'withExcerpt',
  'withoutExcerpt',
  'withSegments',
  'failed',
]
const BACKFILL_ASR_KEYS = ['calls', 'audioSeconds', 'elapsedMs', 'failures']
const BACKFILL_LLM_KEYS = ['calls', 'used', 'failed', 'totalTokens', 'estimatedCostUsd']

/**
 * Folds the per-legislature runs of a `--all` backfill into the combined
 * block. Pure arithmetic — the run report must not depend on network/DB to be
 * summed, so it is unit-tested with hand-written run objects.
 *
 * @param {Array<{ totals?: Record<string, unknown>, asr?: Record<string, unknown>, llm?: Record<string, unknown>, elapsedMs?: unknown }> | null | undefined} runs
 * @returns {{ totals: Record<string, number>, asr: Record<string, number>, llm: Record<string, number | string | null>, elapsedMs: number }}
 */
export const aggregateBackfillRuns = (runs) => {
  const list = Array.isArray(runs) ? runs : []
  const sumBy = (group, keys) =>
    Object.fromEntries(
      keys.map((key) => [
        key,
        list.reduce((total, run) => total + (Number(run?.[group]?.[key]) || 0), 0),
      ]),
    )
  return {
    totals: sumBy('totals', BACKFILL_TOTAL_KEYS),
    asr: sumBy('asr', BACKFILL_ASR_KEYS),
    llm: {
      ...sumBy('llm', BACKFILL_LLM_KEYS),
      sampleError: list.find((run) => run?.llm?.sampleError)?.llm?.sampleError ?? null,
    },
    elapsedMs: list.reduce((total, run) => total + (Number(run?.elapsedMs) || 0), 0),
  }
}

// ---------------------------------------------------------------------------
// Official Diário link (C160)
// ---------------------------------------------------------------------------

const CAMARA_IMAGEM_HOSTS = new Set(['imagem.camara.leg.br', 'imagem.camara.gov.br'])
const LEGACY_DIARIO_PATHS = new Set(['/dc_20b.asp', '/dc_20.asp'])
const MONTA_PDF_PATH = '/montaPdf.asp'
const DIRECT_PDF_PATH = /^\/Imagem\/d\/pdf\/([^/]+\.pdf)$/i

/** Absolute or Câmara-relative URL of a Diário link; null when unparseable. */
const parseDiarioUrl = (raw) => {
  const value = String(raw ?? '').trim()
  if (value === '') return null
  try {
    const url = new URL(value, 'https://imagem.camara.leg.br/')
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

const queryValue = (url, ...names) => {
  for (const name of names) {
    const value = url.searchParams.get(name)
    if (value !== null && value.trim() !== '') return value.trim()
  }
  return null
}

/**
 * The open-data API still emits stale `selCodColecaoCsv` codes for speeches
 * whose Diário is the Câmara collection: `J` and empty return "Documento não
 * encontrado" (measured 2026-09-14) while the same date/page resolves under the
 * current `D` code the Câmara search itself generates. Any other code (e.g.
 * `DCN`) is kept as-is.
 */
const LEGACY_COLLECTION_ALIASES = { '': 'D', J: 'D' }

const normalizeLegacyCollection = (raw) => {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase()
  return LEGACY_COLLECTION_ALIASES[value] ?? value
}

const positiveIntegerOrNull = (value) => {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

/**
 * `Datain` spelling (`25/6/2020`, URL-decoded) → `2020-06-25`; null when the
 * day/month/year is not a real date.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export const parseDiarioDate = (value) => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(value ?? '').trim())
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (day < 1 || month < 1 || month > 12) return null
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null
  return `${match[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * True when the URL is one of the legacy Diário endpoints
 * (`dc_20b.asp`/`dc_20.asp`/`montaPdf.asp` on the Câmara image host), even when
 * its `Datain`/`narquivo` is malformed. The write paths must never store one of
 * these.
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export const isLegacyDiarioUrl = (raw) => {
  const url = parseDiarioUrl(raw)
  return Boolean(
    url &&
    CAMARA_IMAGEM_HOSTS.has(url.hostname) &&
    (LEGACY_DIARIO_PATHS.has(url.pathname) || url.pathname === MONTA_PDF_PATH),
  )
}

/**
 * Parses the legacy Diário visualizer URL (`dc_20b.asp`/`dc_20.asp`) into what
 * the resolver needs: the `.leg.br` lookup URL (the `.gov.br` hop alone measured
 * ~135s on 2026-09-14), the publication identity that keys the cache and the
 * speech page. Null when the URL is not a legacy Diário link with a parseable
 * `Datain`.
 *
 * @param {unknown} raw
 * @returns {{ lookupUrl: string, publication: { date: string, collection: string | null, supplement: string | null }, page: number | null } | null}
 */
export const parseLegacyOfficialUrl = (raw) => {
  const url = parseDiarioUrl(raw)
  if (!url || !CAMARA_IMAGEM_HOSTS.has(url.hostname) || !LEGACY_DIARIO_PATHS.has(url.pathname)) {
    return null
  }
  const date = parseDiarioDate(queryValue(url, 'Datain'))
  if (date === null) return null
  const rawCollection = queryValue(url, 'selCodColecaoCsv', 'selCodColecao')
  const collection = normalizeLegacyCollection(rawCollection)
  const lookupUrl = new URL(url)
  if (lookupUrl.hostname === 'imagem.camara.gov.br') lookupUrl.hostname = 'imagem.camara.leg.br'
  if (collection !== rawCollection) {
    lookupUrl.searchParams.delete('selCodColecaoCsv')
    lookupUrl.searchParams.delete('selCodColecao')
    lookupUrl.searchParams.set('selCodColecaoCsv', collection)
  }
  return {
    lookupUrl: lookupUrl.toString(),
    publication: {
      date,
      collection,
      supplement: queryValue(url, 'txSuplemento'),
    },
    page: positiveIntegerOrNull(queryValue(url, 'txPagina')),
  }
}

/**
 * Parses the intermediate redirect target
 * (`montaPdf.asp?narquivo=DCD….PDF&npagina=73`) into the PDF archive file name
 * and the page. Null when the URL is not a `montaPdf` link or the `narquivo` is
 * not a safe file name (that value goes into a URL path, never into HTML).
 *
 * @param {unknown} raw
 * @returns {{ archiveFileName: string, page: number | null } | null}
 */
export const parseMontaPdfUrl = (raw) => {
  const url = parseDiarioUrl(raw)
  if (!url || !CAMARA_IMAGEM_HOSTS.has(url.hostname) || url.pathname !== MONTA_PDF_PATH) {
    return null
  }
  const archiveFileName = queryValue(url, 'narquivo')
  if (archiveFileName === null || !/^[A-Za-z0-9._-]+$/.test(archiveFileName)) return null
  return { archiveFileName, page: positiveIntegerOrNull(queryValue(url, 'npagina')) }
}

/**
 * The direct official PDF URL, with `#page=<n>` when the page is known; null
 * when the archive file name is empty.
 *
 * @param {unknown} archiveFileName
 * @param {unknown} [page]
 * @returns {string | null}
 */
export const buildOfficialPdfUrl = (archiveFileName, page = null) => {
  const name = String(archiveFileName ?? '').trim()
  if (name === '') return null
  const base = `https://imagem.camara.leg.br/Imagem/d/pdf/${encodeURIComponent(name)}`
  const pageNumber = positiveIntegerOrNull(page)
  return pageNumber === null ? base : `${base}#page=${pageNumber}`
}

/**
 * Parses an already-direct official PDF URL (the format the import writes)
 * back into `{ archiveFileName, page }`. The page comes from the `#page=<n>`
 * fragment; null when the URL is not a Câmara PDF.
 *
 * @param {unknown} raw
 * @returns {{ archiveFileName: string, page: number | null } | null}
 */
export const parseDirectOfficialPdfUrl = (raw) => {
  const url = parseDiarioUrl(raw)
  if (!url || !CAMARA_IMAGEM_HOSTS.has(url.hostname)) return null
  const match = DIRECT_PDF_PATH.exec(url.pathname)
  if (!match) return null
  const pageFromHash = /^#page=(\d+)$/.exec(url.hash)
  return { archiveFileName: match[1], page: positiveIntegerOrNull(pageFromHash?.[1]) }
}

/**
 * `none` (no link), `direct` (already the PDF), `legacy` (`dc_20b`/`dc_20` with
 * a parseable date), `montaPdf` (the intermediate redirect) or `unknown`
 * (anything else). Only `legacy` needs the network; `montaPdf` is converted
 * offline.
 *
 * @param {unknown} raw
 * @returns {'none' | 'direct' | 'legacy' | 'montaPdf' | 'unknown'}
 */
export const classifyOfficialTextUrl = (raw) => {
  if (String(raw ?? '').trim() === '') return 'none'
  const url = parseDiarioUrl(raw)
  if (!url || !CAMARA_IMAGEM_HOSTS.has(url.hostname)) return 'unknown'
  if (LEGACY_DIARIO_PATHS.has(url.pathname)) {
    return parseLegacyOfficialUrl(raw) ? 'legacy' : 'unknown'
  }
  if (url.pathname === MONTA_PDF_PATH) return parseMontaPdfUrl(raw) ? 'montaPdf' : 'unknown'
  if (parseDirectOfficialPdfUrl(raw)) return 'direct'
  return 'unknown'
}

/**
 * What the write paths keep when resolution fails: a previously stored direct
 * PDF (never a legacy link), or null so the UI falls back to YouTube/hides the
 * button.
 *
 * @param {unknown} existingUrl
 * @returns {string | null}
 */
export const officialTextUrlFallback = (existingUrl) =>
  classifyOfficialTextUrl(existingUrl) === 'direct' ? String(existingUrl).trim() : null

/**
 * Filesystem-safe cache key of one Diário publication: date + collection
 * (`D`, `S`, …) + supplement. One network resolution per key, ever.
 *
 * @param {{ date?: string, collection?: string | null, supplement?: string | null } | null | undefined} publication
 * @returns {string | null}
 */
export const publicationCacheKey = (publication) => {
  const date = String(publication?.date ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const collection = String(publication?.collection ?? '').trim()
  const supplement = String(publication?.supplement ?? '').trim()
  const key = [
    date,
    ...(collection === '' ? [] : [collection]),
    ...(supplement === '' ? [] : [`s${supplement}`]),
  ].join('-')
  return key.replace(/[^A-Za-z0-9._-]+/g, '_')
}

/**
 * Splits scanned speeches into the repair work plan: `groups` are legacy URLs
 * sharing one publication (one resolution each), `directUpdates` are
 * `montaPdf` links convertible offline, `alreadyDirect`/`none` are untouched,
 * `unresolvable` are malformed legacy links that must not stay (they fail the
 * write run) and `unknown` is reported. Pure — the caller owns resolution and
 * writes.
 *
 * @param {Array<{ id: number, officialTextUrl?: string | null, speechAt?: string | null, legislature?: string | null }> | null | undefined} rows
 * @returns {{
 *   groups: Array<{ key: string, publication: { date: string, collection: string | null, supplement: string | null }, lookupUrl: string, rows: Array<{ id: number, page: number | null, previousUrl: string, speechAt: string | null, legislature: string | null }> }>,
 *   directUpdates: Array<{ id: number, previousUrl: string, nextUrl: string, speechAt: string | null, legislature: string | null }>,
 *   alreadyDirect: number,
 *   unknown: Array<{ id: number, previousUrl: string, speechAt: string | null, legislature: string | null }>,
 *   unresolvable: Array<{ id: number, previousUrl: string, speechAt: string | null, legislature: string | null }>,
 *   none: number,
 * }}
 */
export const planOfficialLinkRepairs = (rows) => {
  const groups = new Map()
  const directUpdates = []
  const unknown = []
  const unresolvable = []
  let alreadyDirect = 0
  let none = 0

  for (const row of Array.isArray(rows) ? rows : []) {
    const raw = row?.officialTextUrl
    const kind = classifyOfficialTextUrl(raw)
    const meta = {
      id: row?.id,
      previousUrl: String(raw ?? '').trim(),
      speechAt: row?.speechAt ?? null,
      legislature: row?.legislature ?? null,
    }
    if (kind === 'none') {
      none += 1
      continue
    }
    if (kind === 'direct') {
      alreadyDirect += 1
      continue
    }
    if (kind === 'montaPdf') {
      const parsed = parseMontaPdfUrl(raw)
      directUpdates.push({
        ...meta,
        nextUrl: buildOfficialPdfUrl(parsed.archiveFileName, parsed.page),
      })
      continue
    }
    if (kind === 'legacy') {
      const parsed = parseLegacyOfficialUrl(raw)
      const key = publicationCacheKey(parsed.publication)
      const group = groups.get(key) ?? {
        key,
        publication: parsed.publication,
        lookupUrl: parsed.lookupUrl,
        rows: [],
      }
      group.rows.push({ ...meta, page: parsed.page })
      groups.set(key, group)
      continue
    }
    if (isLegacyDiarioUrl(raw)) unresolvable.push(meta)
    else unknown.push(meta)
  }

  return {
    groups: [...groups.values()].sort((left, right) => left.key.localeCompare(right.key)),
    directUpdates,
    alreadyDirect,
    unknown,
    unresolvable,
    none,
  }
}

/**
 * Deterministic VOD-link sample for the `--verify-links` mode: up to
 * `perLegislature` speeches per legislature that actually carry a VOD link,
 * spread evenly over the legislature ordered by `speechAt` + id. Same DB state
 * → same sample, so the verification is reproducible and reportable.
 *
 * @param {Array<{ id: number, legislature?: string | null, speechAt?: string | null, vodPlaybackUrl?: string | null, vodDownloadUrl?: string | null }> | null | undefined} rows
 * @param {number} perLegislature
 * @returns {Array<{ id: number, legislature?: string | null, speechAt?: string | null, vodPlaybackUrl?: string | null, vodDownloadUrl?: string | null }>}
 */
export const selectLinkSample = (rows, perLegislature) => {
  const limit = Math.max(1, Math.trunc(Number(perLegislature) || 1))
  const byLegislature = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.vodPlaybackUrl && !row?.vodDownloadUrl) continue
    const key = String(row.legislature ?? '')
    byLegislature.set(key, [...(byLegislature.get(key) ?? []), row])
  }

  const sample = []
  for (const key of [...byLegislature.keys()].sort()) {
    const ordered = [...byLegislature.get(key)].sort(
      (left, right) =>
        String(left.speechAt ?? '').localeCompare(String(right.speechAt ?? '')) ||
        Number(left.id) - Number(right.id),
    )
    const indexes = new Set()
    if (limit >= ordered.length) {
      for (let index = 0; index < ordered.length; index += 1) indexes.add(index)
    } else {
      for (let index = 0; index < limit; index += 1) {
        indexes.add(Math.floor((index * ordered.length) / limit))
      }
    }
    for (const index of [...indexes].sort((left, right) => left - right)) {
      sample.push(ordered[index])
    }
  }
  return sample
}
