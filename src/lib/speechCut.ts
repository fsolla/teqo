/**
 * C167 — pure rules of a speech cut: the status/step vocabulary, the
 * deterministic metadata fallback, the ffmpeg command for the exact
 * [start, end] MP4 and the public view model. No I/O and no `server-only`:
 * the dialog (client) and the job (server) share this module.
 */
import { CAMPAIGN_COMMUNICATION_ACERVO, campaignInternetSpeechHref } from '@/lib/campaignPaths'
import { formatBahiaCivilDate } from '@/lib/campaignTime'
import { buildWhatsAppTextShareUrl } from '@/lib/phone'
import { relationshipId } from '@/lib/relationship'
import { SPEECH_VOD_INELIGIBLE_MESSAGE } from '@/lib/schemas/speechVod'
import { formatSpeechDate, formatSpeechSpan } from '@/lib/speechClock'
import {
  parseYoutubeVideoId,
  speechVodCoordinates,
  type SpeechVodCoordinatesSource,
} from '@/lib/speechVod'
import { webSpeechDisplayTitle, type WebSpeechPlatform } from '@/lib/webSpeech'

export const SPEECH_CUT_STATUSES = ['processing', 'published', 'unpublished', 'failed'] as const
export type SpeechCutStatus = (typeof SPEECH_CUT_STATUSES)[number]

/** One owner for the persisted field limits (collection, schema and dialog). */
export const SPEECH_CUT_TITLE_MAX_LENGTH = 200
export const SPEECH_CUT_DESCRIPTION_MAX_LENGTH = 2000

export const speechCutStatusLabels: Record<SpeechCutStatus, string> = {
  processing: 'Processando',
  published: 'Publicado',
  unpublished: 'Despublicado',
  failed: 'Falhou',
}

const isSpeechCutStatus = (value: unknown): value is SpeechCutStatus =>
  SPEECH_CUT_STATUSES.includes(value as SpeechCutStatus)

export const SPEECH_CUT_STEPS = ['resolving', 'cutting', 'metadata', 'publishing'] as const
export type SpeechCutStep = (typeof SPEECH_CUT_STEPS)[number]

/** The four honest progress steps the dialog shows (draft scene 2). */
export const speechCutStepLabels: Record<SpeechCutStep, string> = {
  resolving: 'Localizando o trecho na Câmara',
  cutting: 'Cortando o trecho',
  metadata: 'Gerando título e descrição',
  publishing: 'Publicando a página do corte',
}

/** C217 — the web speech has no Câmara to locate; only this step renames. */
const WEB_SPEECH_CUT_STEP_LABELS: Record<SpeechCutStep, string> = {
  ...speechCutStepLabels,
  resolving: 'Localizando o arquivo da fala',
}

/**
 * C217 — which acquisition path a cut uses: the Câmara VOD or the private
 * mirrored file of a web speech. The predicate is the single owner of the
 * decision (the action refuses and the job branches through it); `null` means
 * the speech cannot be cut at all — a web speech without a mirror never falls
 * back to the Câmara VOD.
 *
 * `speechCutOriginKind` is the narrower vocabulary question ("whose speech is
 * this?") that the copy/prompt paths ask: a web speech without a mirror is
 * still a web speech, never a Câmara one.
 */
export type SpeechCutSourceKind = 'camara' | 'web'

type SpeechCutSourceRecord = SpeechVodCoordinatesSource & {
  origin?: string | null
  mirroredMedia?: number | { id: number } | null
}

export const speechCutOriginKind = (speech: { origin?: string | null }): SpeechCutSourceKind =>
  speech.origin === 'web' ? 'web' : 'camara'

export const speechCutSourceKind = (speech: SpeechCutSourceRecord): SpeechCutSourceKind | null => {
  if (speechCutOriginKind(speech) === 'web') {
    return relationshipId(speech.mirroredMedia) === null ? null : 'web'
  }
  return speechVodCoordinates(speech) ? 'camara' : null
}

const isSpeechCutStep = (value: unknown): value is SpeechCutStep =>
  SPEECH_CUT_STEPS.includes(value as SpeechCutStep)

/** C217 — the step label by source; the Câmara keeps the historical literals. */
export const speechCutStepLabel = (
  step: SpeechCutStep,
  source: SpeechCutSourceKind = 'camara',
): string => (source === 'web' ? WEB_SPEECH_CUT_STEP_LABELS[step] : speechCutStepLabels[step])

/**
 * C169 — the causes the job and the reaper store in `error` (the operator's
 * detail) and the honest pt-BR copy the dialog shows for each one. Only these
 * literals — or the failure step — ever reach the person; a raw transport
 * message (URL, stderr) stays in the admin.
 */
export const SPEECH_CUT_FAILURE_SPEECH_GONE = 'A fala deste corte não está mais disponível.'
export const SPEECH_CUT_FAILURE_GENERATING = 'A Câmara ainda está gerando o vídeo deste trecho.'
export const SPEECH_CUT_FAILURE_UNAVAILABLE = 'A Câmara não entregou o arquivo deste trecho.'
export const SPEECH_CUT_FAILURE_UNPLAYABLE =
  'A Câmara não entregou um arquivo jogável deste trecho.'
export const SPEECH_CUT_FAILURE_INTERRUPTED = 'O corte foi interrompido antes de terminar.'
/** C217 — the web cut died because the private mirror is gone. */
export const SPEECH_CUT_FAILURE_MIRROR_MISSING =
  'O arquivo espelhado desta fala não está mais disponível.'

const SPEECH_CUT_FAILURE_INELIGIBLE_COPY = 'Esta fala não tem trecho de vídeo para cortar.'
const SPEECH_CUT_FAILURE_UNAVAILABLE_COPY =
  'A Câmara não disponibiliza mais o arquivo deste trecho.'
const SPEECH_CUT_FAILURE_UNPLAYABLE_COPY =
  'A Câmara não disponibilizou um arquivo válido deste trecho.'
const SPEECH_CUT_FAILURE_RESOLVING_COPY = 'Não foi possível localizar o trecho na Câmara.'
const SPEECH_CUT_FAILURE_MIRROR_RESOLVING_COPY = 'Não foi possível localizar o arquivo da fala.'
const SPEECH_CUT_FAILURE_CUTTING_COPY = 'Não foi possível cortar o trecho.'
const SPEECH_CUT_FAILURE_STORING_COPY = 'Não foi possível guardar o arquivo do corte.'
const SPEECH_CUT_FAILURE_UNKNOWN_COPY = 'Não foi possível preparar o corte.'

/**
 * Maps the stored cause of a failed cut to what the person reads: the exact
 * literal when the job named it, otherwise the failure step (cortar ≠ guardar),
 * otherwise a generic-but-honest line. Null when the row stored no cause at all.
 */
export const speechCutFailureMessage = ({
  error,
  step,
  source = 'camara',
}: {
  error?: string | null
  step?: SpeechCutStep | null
  source?: SpeechCutSourceKind
}): string | null => {
  const stored = error?.trim()
  if (!stored) return null

  if (stored === SPEECH_CUT_FAILURE_SPEECH_GONE) return SPEECH_CUT_FAILURE_SPEECH_GONE
  if (stored === SPEECH_VOD_INELIGIBLE_MESSAGE) return SPEECH_CUT_FAILURE_INELIGIBLE_COPY
  if (stored === SPEECH_CUT_FAILURE_GENERATING) return SPEECH_CUT_FAILURE_GENERATING
  if (stored === SPEECH_CUT_FAILURE_UNAVAILABLE) return SPEECH_CUT_FAILURE_UNAVAILABLE_COPY
  if (stored === SPEECH_CUT_FAILURE_UNPLAYABLE) return SPEECH_CUT_FAILURE_UNPLAYABLE_COPY
  if (stored === SPEECH_CUT_FAILURE_INTERRUPTED) return SPEECH_CUT_FAILURE_INTERRUPTED
  if (stored === SPEECH_CUT_FAILURE_MIRROR_MISSING) return SPEECH_CUT_FAILURE_MIRROR_MISSING

  if (step === 'resolving') {
    return source === 'web'
      ? SPEECH_CUT_FAILURE_MIRROR_RESOLVING_COPY
      : SPEECH_CUT_FAILURE_RESOLVING_COPY
  }
  if (step === 'cutting') return SPEECH_CUT_FAILURE_CUTTING_COPY
  if (step === 'metadata' || step === 'publishing') return SPEECH_CUT_FAILURE_STORING_COPY
  return SPEECH_CUT_FAILURE_UNKNOWN_COPY
}

type SpeechCutStepState = {
  step: SpeechCutStep
  label: string
  state: 'done' | 'current' | 'queued'
}

/** Step list of a running cut: everything before `current` is done, the rest queued. */
export const speechCutStepStates = (
  current: SpeechCutStep | null,
  source: SpeechCutSourceKind = 'camara',
): SpeechCutStepState[] => {
  const currentIndex = current ? SPEECH_CUT_STEPS.indexOf(current) : -1
  return SPEECH_CUT_STEPS.map((step, index) => ({
    step,
    label: speechCutStepLabel(step, source),
    state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'queued',
  }))
}

const FALLBACK_SPEECH_TYPE = 'fala'

/** Trim + clip used by every metadata path (fallback and AI output). */
export const clipSpeechCutText = (value: string, maximum: number): string =>
  value.slice(0, maximum).trim()

/**
 * Deterministic fallback for title/description when the AI is unavailable: the
 * title always names the excerpt (`Trecho de <tipo> — <data>`) and the
 * description prefers the official summary. Never empty — both fields are
 * required on the row and on the public page.
 */
export const buildSpeechCutFallbackMetadata = ({
  speechType,
  dateLabel,
  summary,
  source = 'camara',
}: {
  speechType: string | null
  dateLabel: string
  summary: string | null
  /** C217 — the web source never claims the Câmara in the description. */
  source?: SpeechCutSourceKind
}): { title: string; description: string } => {
  const type = speechType?.trim() || FALLBACK_SPEECH_TYPE
  return {
    title: clipSpeechCutText(`Trecho de ${type} — ${dateLabel}`, SPEECH_CUT_TITLE_MAX_LENGTH),
    description: clipSpeechCutText(
      summary?.trim() ||
        (source === 'web'
          ? `Trecho de ${type} de ${dateLabel}, publicado na internet.`
          : `Trecho de ${type} de ${dateLabel}, na Câmara dos Deputados.`),
      SPEECH_CUT_DESCRIPTION_MAX_LENGTH,
    ),
  }
}

type SpeechCutFfmpegInput = {
  inputPath: string
  outputPath: string
  startSeconds: number
  endSeconds: number
}

/**
 * The exact-window prefix both cut commands share: `-ss` before `-i` seeks fast
 * and `-t` carries the duration so a timestamp offset in the source cannot
 * shift the end. Args are returned as an array — never a shell string.
 */
const cutWindowArgs = (input: SpeechCutFfmpegInput): string[] => {
  const start = Math.max(0, Math.round(input.startSeconds))
  const duration = Math.max(0, Math.round(input.endSeconds) - start)
  return [
    '-nostdin',
    '-hide_banner',
    '-y',
    '-ss',
    String(start),
    '-i',
    input.inputPath,
    '-t',
    String(duration),
  ]
}

/**
 * Exact-cut command: the re-encode (no `-c copy`) starts the output exactly at
 * the picked second instead of the previous keyframe; `+faststart` lets the
 * proxied MP4 play progressively.
 */
export const buildSpeechCutFfmpegArgs = ({
  inputPath,
  outputPath,
  startSeconds,
  endSeconds,
}: SpeechCutFfmpegInput): string[] => [
  ...cutWindowArgs({ inputPath, outputPath, startSeconds, endSeconds }),
  '-map',
  '0:v:0',
  '-map',
  '0:a?',
  '-c:v',
  'libx264',
  '-preset',
  'veryfast',
  '-crf',
  '20',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-movflags',
  '+faststart',
  outputPath,
]

/**
 * C217 — the audio-only variant of the exact cut (radio/direct-audio mirrors):
 * the same `-ss`/`-t` window, but the input has no video stream to map, so the
 * output is an audio-only MP4 (AAC + `+faststart`) — the same `.mp4` contract
 * the library card and the public page already play.
 */
export const buildSpeechCutAudioFfmpegArgs = ({
  inputPath,
  outputPath,
  startSeconds,
  endSeconds,
}: SpeechCutFfmpegInput): string[] => [
  ...cutWindowArgs({ inputPath, outputPath, startSeconds, endSeconds }),
  '-map',
  '0:a:0',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-movflags',
  '+faststart',
  outputPath,
]

/** Public, unlisted page of a cut — the numeric id survives a title edit. */
export const speechCutPublicPath = (id: number): string => `/corte/${id}`

type SpeechCutShare = {
  url: string
  message: string
  whatsAppUrl: string
}

/** Share payload of a published cut: the title followed by the public link. */
export const buildSpeechCutShare = ({
  title,
  url,
}: {
  title: string
  url: string
}): SpeechCutShare => {
  const message = `${title.trim()} ${url}`
  return { url, message, whatsAppUrl: buildWhatsAppTextShareUrl(message) }
}

type CutMediaRecord = { url?: string | null; filename?: string | null }
type CutSpeechRecord = {
  /** Populated at depth 1; absent when the relation was not expanded. */
  id?: number
  youtubeUrl?: string | null
  type?: string | null
  phase?: string | null
  speechAt?: string | null
  /** C217 — web rows carry their own origin vocabulary and display title. */
  origin?: string | null
  platform?: WebSpeechPlatform | null
  title?: string | null
}
type CutDurationRecord = { durationSeconds?: number | null }

export type SpeechCutRecordForView = CutDurationRecord & {
  id: number
  status: string
  step?: string | null
  title: string
  description: string
  startSeconds: number
  endSeconds: number
  media?: number | CutMediaRecord | null
  speech?: number | CutSpeechRecord | null
  publishedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  /** Raw internal cause of a failure; never handed to the client as-is. */
  error?: string | null
}

export type SpeechCutViewModel = {
  id: number
  status: SpeechCutStatus
  step: SpeechCutStep | null
  title: string
  description: string
  startSeconds: number
  endSeconds: number
  /** Stored span, stable even if the speech row changes; falls back to end − start. */
  durationSeconds: number
  durationLabel: string
  publicPath: string
  mediaUrl: string | null
  mediaFilename: string | null
  youtubeVideoId: string | null
  publishedAt: string | null
  /** C169 — honest cause of a failure; null unless `status === 'failed'`. */
  failureMessage: string | null
}

/**
 * C180 — the narrow view of a cut for the discovery surfaces ("Cortes desta
 * fala" and the search nesting): everything they render, nothing they don't
 * (`media*`/`publicPath`/`youtubeVideoId`/`failureMessage`/`step` stay out).
 */
export type SpeechCutSummaryViewModel = {
  id: number
  status: SpeechCutStatus
  title: string
  description: string
  /** Stored span, stable even if the speech row changes; falls back to end − start. */
  durationSeconds: number
}

/**
 * The shape the summary mapper needs. Payload does not reflect `select` in the
 * result type, so this must stay field-for-field with `speechCutSummarySelect`
 * in `utilities/speech/speechCutPageData.ts`.
 */
type SpeechCutSummaryRecord = Pick<
  SpeechCutRecordForView,
  'id' | 'status' | 'title' | 'description' | 'startSeconds' | 'endSeconds' | 'durationSeconds'
>

const mediaOf = (media: SpeechCutRecordForView['media']): CutMediaRecord | null =>
  typeof media === 'object' && media !== null ? media : null

const youtubeUrlOf = (speech: SpeechCutRecordForView['speech']): string | null =>
  typeof speech === 'object' && speech !== null ? (speech.youtubeUrl ?? null) : null

/** C217 — the source of a cut, read from its origin speech (absent → Câmara). */
const speechSourceOf = (speech: SpeechCutRecordForView['speech']): SpeechCutSourceKind =>
  typeof speech === 'object' && speech !== null ? speechCutOriginKind(speech) : 'camara'

/** Stored span when present, else the raw [start, end] fallback, floored at 0. */
const cutDurationSeconds = (record: SpeechCutSummaryRecord): number =>
  typeof record.durationSeconds === 'number' && Number.isFinite(record.durationSeconds)
    ? Math.max(0, Math.round(record.durationSeconds))
    : Math.max(0, Math.round(record.endSeconds) - Math.round(record.startSeconds))

/**
 * Internal/status wire view of a cut. `error` and `createdBy` never pass
 * through here: the public page and the dialog receive only what they render —
 * a failure becomes the mapped `failureMessage`, never the raw detail.
 */
export const toSpeechCutViewModel = (record: SpeechCutRecordForView): SpeechCutViewModel => {
  const media = mediaOf(record.media)
  const status = isSpeechCutStatus(record.status) ? record.status : 'failed'
  const step = isSpeechCutStep(record.step) ? record.step : null
  const durationSeconds = cutDurationSeconds(record)

  return {
    id: record.id,
    status,
    step,
    title: record.title,
    description: record.description,
    startSeconds: record.startSeconds,
    endSeconds: record.endSeconds,
    durationSeconds,
    durationLabel: formatSpeechSpan(durationSeconds),
    publicPath: speechCutPublicPath(record.id),
    mediaUrl: media?.url ?? null,
    mediaFilename: media?.filename ?? null,
    youtubeVideoId: parseYoutubeVideoId(youtubeUrlOf(record.speech)),
    publishedAt: record.publishedAt ?? null,
    failureMessage:
      status === 'failed'
        ? speechCutFailureMessage({
            error: record.error,
            step,
            source: speechSourceOf(record.speech),
          })
        : null,
  }
}

/**
 * C180 — narrow view of a cut for the discovery surfaces, reusing the same
 * duration fallback and status normalization as the full view (an unknown
 * status still degrades to `failed`, so the badge never receives a stray value).
 */
export const toSpeechCutSummaryViewModel = (
  record: SpeechCutSummaryRecord,
): SpeechCutSummaryViewModel => ({
  id: record.id,
  status: isSpeechCutStatus(record.status) ? record.status : 'failed',
  title: record.title,
  description: record.description,
  durationSeconds: cutDurationSeconds(record),
})

/**
 * C180 — volume ceiling for the origin `id in` the acervo ORs into its textual
 * `where`. A common term can match thousands of cuts; the cap degrades the
 * "origin-only" surface (fewer origin speeches), never the result's correctness
 * — the "Fala de origem" flag comes from the predicate, not from these ids.
 * Revisit when the catalog approaches ~5–10k cuts (same trigger as C168).
 */
export const SPEECH_CUT_ORIGIN_SPEECH_ID_LIMIT = 200

/**
 * Deduped origin speech ids of a batch of cuts, capped at `limit`. Depth 0
 * keeps an unresolved relation as the raw id; a populated relation contributes
 * its `.id`, and a missing/null relation is skipped.
 */
export const originSpeechIdsOfCuts = (
  cuts: readonly { speech?: number | CutSpeechRecord | null }[],
  limit = SPEECH_CUT_ORIGIN_SPEECH_ID_LIMIT,
): number[] => {
  const ids = new Set<number>()
  for (const cut of cuts) {
    if (ids.size >= limit) break
    const speechId = typeof cut.speech === 'number' ? cut.speech : cut.speech?.id
    if (typeof speechId === 'number') ids.add(speechId)
  }
  return [...ids]
}

/** Origin of a cut in the library: the speech it was cut from, with its link. */
export type SpeechCutOriginViewModel = {
  id: number
  /** C217 — the Câmara link and label stay as they were; the web has its own. */
  source: SpeechCutSourceKind
  /** "Fala · Breves Comunicações · 11/08/2026" (Câmara) or the web speech title. */
  label: string
  /** C217 — the web platform of the origin (drives the pill); null on Câmara rows. */
  platform: WebSpeechPlatform | null
  href: string
}

export type SpeechCutLibraryItemViewModel = SpeechCutViewModel & {
  /** "Criado em dd/mm/aaaa" date part; null when the row has no timestamp. */
  createdAtLabel: string | null
  /** Null when the source speech was deleted (FK `SET NULL`) — degrade, don't break. */
  origin: SpeechCutOriginViewModel | null
}

const formatCreatedAtLabel = (createdAt: string | null | undefined): string | null => {
  if (!createdAt) return null
  const instant = new Date(createdAt)
  if (Number.isNaN(instant.getTime())) return null
  return formatSpeechDate(formatBahiaCivilDate(instant))
}

const originOf = (speech: SpeechCutRecordForView['speech']): SpeechCutOriginViewModel | null => {
  if (typeof speech !== 'object' || speech === null || typeof speech.id !== 'number') return null

  // C217 — a web speech links back to its own detail and shows the platform;
  // the Câmara composition is unchanged byte for byte.
  if (speech.origin === 'web') {
    return {
      id: speech.id,
      source: 'web',
      label: webSpeechDisplayTitle({ id: speech.id, title: speech.title }),
      platform: speech.platform ?? null,
      href: campaignInternetSpeechHref(speech.id),
    }
  }

  const dateLabel = speech.speechAt ? formatSpeechDate(speech.speechAt) : null
  const label =
    [speech.type ?? 'Fala', speech.phase, dateLabel].filter(Boolean).join(' · ') || 'Fala'
  return {
    id: speech.id,
    source: 'camara',
    label,
    platform: null,
    href: `${CAMPAIGN_COMMUNICATION_ACERVO}/${speech.id}`,
  }
}

/**
 * C168 — library view of a cut: the base view plus the origin speech (label +
 * link to the acervo) and the creation date the list shows. `error` and
 * `createdBy` still never pass through (a failure travels as `failureMessage`).
 */
export const toSpeechCutLibraryItemViewModel = (
  record: SpeechCutRecordForView,
): SpeechCutLibraryItemViewModel => ({
  ...toSpeechCutViewModel(record),
  createdAtLabel: formatCreatedAtLabel(record.createdAt),
  origin: originOf(record.speech),
})
