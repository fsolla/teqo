/**
 * C167 — pure rules of a speech cut: the status/step vocabulary, the
 * deterministic metadata fallback, the ffmpeg command for the exact
 * [start, end] MP4 and the public view model. No I/O and no `server-only`:
 * the dialog (client) and the job (server) share this module.
 */
import { buildWhatsAppTextShareUrl } from '@/lib/phone'
import { formatSpeechSpan } from '@/lib/speechClock'
import { parseYoutubeVideoId } from '@/lib/speechVod'

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

const isSpeechCutStep = (value: unknown): value is SpeechCutStep =>
  SPEECH_CUT_STEPS.includes(value as SpeechCutStep)

type SpeechCutStepState = {
  step: SpeechCutStep
  label: string
  state: 'done' | 'current' | 'queued'
}

/** Step list of a running cut: everything before `current` is done, the rest queued. */
export const speechCutStepStates = (current: SpeechCutStep | null): SpeechCutStepState[] => {
  const currentIndex = current ? SPEECH_CUT_STEPS.indexOf(current) : -1
  return SPEECH_CUT_STEPS.map((step, index) => ({
    step,
    label: speechCutStepLabels[step],
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
}: {
  speechType: string | null
  dateLabel: string
  summary: string | null
}): { title: string; description: string } => {
  const type = speechType?.trim() || FALLBACK_SPEECH_TYPE
  return {
    title: clipSpeechCutText(`Trecho de ${type} — ${dateLabel}`, SPEECH_CUT_TITLE_MAX_LENGTH),
    description: clipSpeechCutText(
      summary?.trim() || `Trecho de ${type} de ${dateLabel}, na Câmara dos Deputados.`,
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
 * Exact-cut command: `-ss` before `-i` seeks fast and the re-encode (no
 * `-c copy`) starts the output exactly at the picked second instead of the
 * previous keyframe. `-t` carries the duration so a timestamp offset in the
 * source cannot shift the end; `+faststart` lets the proxied MP4 play
 * progressively. Args are returned as an array — never a shell string.
 */
export const buildSpeechCutFfmpegArgs = ({
  inputPath,
  outputPath,
  startSeconds,
  endSeconds,
}: SpeechCutFfmpegInput): string[] => {
  const start = Math.max(0, Math.round(startSeconds))
  const duration = Math.max(0, Math.round(endSeconds) - start)
  return [
    '-nostdin',
    '-hide_banner',
    '-y',
    '-ss',
    String(start),
    '-i',
    inputPath,
    '-t',
    String(duration),
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
}

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
type CutSpeechRecord = { youtubeUrl?: string | null }
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
  updatedAt?: string | null
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
}

const mediaOf = (media: SpeechCutRecordForView['media']): CutMediaRecord | null =>
  typeof media === 'object' && media !== null ? media : null

const youtubeUrlOf = (speech: SpeechCutRecordForView['speech']): string | null =>
  typeof speech === 'object' && speech !== null ? (speech.youtubeUrl ?? null) : null

/**
 * Internal/status wire view of a cut. `error` and `createdBy` never pass
 * through here: the public page and the dialog receive only what they render.
 */
export const toSpeechCutViewModel = (record: SpeechCutRecordForView): SpeechCutViewModel => {
  const media = mediaOf(record.media)
  const status = isSpeechCutStatus(record.status) ? record.status : 'failed'
  const step = isSpeechCutStep(record.step) ? record.step : null
  const durationSeconds =
    typeof record.durationSeconds === 'number' && Number.isFinite(record.durationSeconds)
      ? Math.max(0, Math.round(record.durationSeconds))
      : Math.max(0, Math.round(record.endSeconds) - Math.round(record.startSeconds))

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
  }
}
