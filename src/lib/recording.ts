/**
 * C199 — pure rules of an uploaded recording: the status/step vocabulary, the
 * upload limits and the honest failure copy. No I/O and no `server-only`: the
 * client dialog, the JSON routes, the job and the unit tests share this module.
 */
import {
  CAMPAIGN_COMMUNICATION_ACERVO_GRAVACOES,
  campaignRecordingDeleteHref,
  campaignRecordingFileHref,
  campaignRecordingRetryHref,
} from '@/lib/campaignPaths'
import { formatSpeechClock, formatSpeechDate } from '@/lib/speechClock'

/** Owner of the private upload collection slug (collection, config and routes). */
export const RECORDING_MEDIA_SLUG = 'recordingMedia' as const

export const RECORDING_STATUSES = ['uploading', 'processing', 'ready', 'failed'] as const
export type RecordingStatus = (typeof RECORDING_STATUSES)[number]

export const recordingStatusLabels: Record<RecordingStatus, string> = {
  uploading: 'Enviando',
  processing: 'Processando',
  ready: 'Pronto',
  failed: 'Falhou',
}

export const isRecordingStatus = (value: unknown): value is RecordingStatus =>
  RECORDING_STATUSES.includes(value as RecordingStatus)

/** One owner for the persisted field limits (collection, schema and dialog). */
export const RECORDING_TITLE_MAX_LENGTH = 200

/** Upload ceiling: hours of plenary are the real case, 4 GiB is the guard. */
export const RECORDING_MAX_BYTES = 4 * 1024 * 1024 * 1024
export const RECORDING_MAX_SIZE_LABEL = '4 GB'
const RECORDING_ACCEPTED_MIME_PREFIX = 'video/'

export const RECORDING_STEPS = ['extracting', 'transcribing', 'saving'] as const
export type RecordingStep = (typeof RECORDING_STEPS)[number]

export const recordingStepLabels: Record<RecordingStep, string> = {
  extracting: 'Preparando o áudio da gravação',
  transcribing: 'Transcrevendo a gravação',
  saving: 'Guardando a transcrição',
}

const isRecordingStep = (value: unknown): value is RecordingStep =>
  RECORDING_STEPS.includes(value as RecordingStep)

/**
 * C199 — the causes the job and the reaper store in `error` (the operator's
 * detail) and the honest pt-BR copy the detail shows. A raw transport message
 * (URL, stderr) stays in the admin.
 */
export const RECORDING_FAILURE_INTERRUPTED = 'O processamento foi interrompido antes de terminar.'

const RECORDING_FAILURE_EXTRACTING_COPY = 'Não foi possível preparar o áudio da gravação.'
const RECORDING_FAILURE_TRANSCRIBING_COPY = 'Não foi possível transcrever a gravação.'
const RECORDING_FAILURE_SAVING_COPY = 'Não foi possível guardar a transcrição.'
const RECORDING_FAILURE_UNKNOWN_COPY = 'Não foi possível transcrever a gravação.'

/**
 * Maps the stored cause of a failed recording to what the person reads: the
 * exact literal when the job named it, otherwise the failure step, otherwise a
 * generic-but-honest line. Null when the row stored no cause at all.
 */
export const recordingFailureMessage = ({
  error,
  step,
}: {
  error?: string | null
  step?: RecordingStep | null
}): string | null => {
  const stored = error?.trim()
  if (!stored) return null

  if (stored === RECORDING_FAILURE_INTERRUPTED) return RECORDING_FAILURE_INTERRUPTED
  if (step === 'extracting') return RECORDING_FAILURE_EXTRACTING_COPY
  if (step === 'transcribing') return RECORDING_FAILURE_TRANSCRIBING_COPY
  if (step === 'saving') return RECORDING_FAILURE_SAVING_COPY
  return RECORDING_FAILURE_UNKNOWN_COPY
}

/**
 * The recording file (player/download) only exists once the upload stream
 * finished: `uploading` has no stored object yet, every other status serves it.
 */
export const canServeRecordingMedia = (status: RecordingStatus): boolean => status !== 'uploading'

/** The retry button only applies to a failed transcription. */
export const canRetryRecording = (status: RecordingStatus): boolean => status === 'failed'

/** Errors of the upload form (client validation). Wire messages live in schemas. */
export const RECORDING_FILE_REQUIRED_MESSAGE = 'Escolha um arquivo de vídeo para enviar.'
export const RECORDING_TITLE_REQUIRED_MESSAGE = 'Informe um título para a gravação.'
export const RECORDING_FILE_TYPE_MESSAGE =
  'Envie um arquivo de vídeo (MP4, MOV, MKV e formatos compatíveis).'

/** A missing type is accepted: `.mkv` often arrives with no `type` from the OS. */
export const recordingFileTypeAllowed = (mimeType: string | null | undefined): boolean =>
  !mimeType || mimeType.startsWith(RECORDING_ACCEPTED_MIME_PREFIX)

/** Basename without path parts or unsafe characters, keeping the extension. */
export const sanitizeRecordingFilename = (filename: string): string => {
  const base = filename.split(/[\\/]/).pop() ?? ''
  const safe = base.replace(/[^\w.-]+/g, '_').replace(/^[._]+/, '')
  return safe || 'gravacao'
}

/** Human-readable file size in pt-BR (`4,6 GB`, `812 MB`, `900 KB`, `12 B`). */
export const formatRecordingFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes >= 1024 ** 3)
    return `${(bytes / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2).toLocaleString('pt-BR')} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024).toLocaleString('pt-BR')} KB`
  return `${Math.round(bytes)} B`
}

export const recordingTooLargeMessage = (bytes: number): string =>
  `Este arquivo tem ${formatRecordingFileSize(bytes)}. Escolha um vídeo de até ${RECORDING_MAX_SIZE_LABEL}.`

export const recordingUploadTooLargeMessage = `O arquivo excede o limite de ${RECORDING_MAX_SIZE_LABEL}.`

export type RecordingViewModel = {
  id: number
  title: string
  status: RecordingStatus
  step: RecordingStep | null
  /** `dd/mm/aaaa` when the row has a date; null otherwise. */
  recordedAtLabel: string | null
  durationLabel: string | null
  /** Raw duration for the detail player; null while it is unknown. */
  durationSeconds: number | null
  detailHref: string
  fileHref: string
  downloadHref: string
  retryHref: string
  deleteHref: string
}

type RecordingViewRecord = {
  id: number
  title?: string | null
  status: string
  step?: string | null
  recordedAt?: string | null
  durationSeconds?: number | null
}

const dateLabelOf = (value: string | null | undefined): string | null =>
  /^(\d{4})-(\d{2})-(\d{2})/.test(value ?? '') && value ? formatSpeechDate(value) : null

const durationLabelOf = (seconds: number | null | undefined): string | null =>
  typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? formatSpeechClock(seconds)
    : null

const normalizedStatus = (value: string): RecordingStatus =>
  isRecordingStatus(value) ? value : 'failed'

/**
 * Internal/status wire view of a recording. `error` and `createdBy` never pass
 * through here: the detail receives only what it renders — a failure becomes
 * the mapped `failureMessage`, never the raw detail.
 */
export const toRecordingViewModel = (record: RecordingViewRecord): RecordingViewModel => {
  const status = normalizedStatus(record.status)
  return {
    id: record.id,
    title: record.title?.trim() || `Gravação ${record.id}`,
    status,
    step: isRecordingStep(record.step) ? record.step : null,
    recordedAtLabel: dateLabelOf(record.recordedAt),
    durationLabel: durationLabelOf(record.durationSeconds),
    durationSeconds:
      typeof record.durationSeconds === 'number' && Number.isFinite(record.durationSeconds)
        ? Math.max(0, record.durationSeconds)
        : null,
    detailHref: `${CAMPAIGN_COMMUNICATION_ACERVO_GRAVACOES}/${record.id}`,
    fileHref: campaignRecordingFileHref(record.id),
    downloadHref: campaignRecordingFileHref(record.id, true),
    retryHref: campaignRecordingRetryHref(record.id),
    deleteHref: campaignRecordingDeleteHref(record.id),
  }
}
