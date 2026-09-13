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
 * updated in place across imports (C153 idempotency).
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
 * Official keywords come as a newline-separated string; keep each keyword raw.
 *
 * @param {unknown} raw
 * @returns {string[]}
 */
export const parseOfficialKeywords = (raw) =>
  String(raw ?? '')
    .split(/[\r\n]+/)
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
