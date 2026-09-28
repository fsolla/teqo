import { z } from 'zod'

import {
  RECORDING_SPEAKER_LABEL_LONG_MESSAGE,
  RECORDING_SPEAKER_LABEL_MAX_LENGTH,
  RECORDING_SPEAKER_LABEL_REQUIRED_MESSAGE,
  RECORDING_TITLE_MAX_LENGTH,
  RECORDING_TITLE_REQUIRED_MESSAGE,
} from '@/lib/recording'
import { trimmedOptionalText } from '@/lib/schemas/primitives'

/** The acervo gate refused the actor — one literal shared with the vertical. */
export const RECORDING_FORBIDDEN_MESSAGE = 'Seu perfil não tem acesso ao acervo de comunicação.'

/** The recording does not exist (or the actor cannot read it). */
export const RECORDING_NOT_FOUND_MESSAGE = 'Gravação não encontrada.'

/** Retry only applies to a failed recording. */
export const RECORDING_RETRY_NOT_FAILED_MESSAGE =
  'Só é possível reprocessar uma gravação que falhou.'

/** Transport/storage failure (or anything unmapped) of a JSON action. */
export const RECORDING_GENERIC_ERROR_MESSAGE =
  'Não foi possível concluir a ação. Verifique seu acesso e tente novamente.'

/** The recording upload arrived without a file name. */
export const RECORDING_FILE_NAME_MESSAGE = 'Nome de arquivo inválido.'

/** The declared file size arrived missing or invalid. */
const RECORDING_FILE_SIZE_MESSAGE = 'Tamanho de arquivo inválido.'

/** C199-fix — one chunk arrived out of order (or duplicated). */
export const RECORDING_CHUNK_OUT_OF_ORDER_MESSAGE =
  'Uma parte do envio chegou fora de ordem. Envie a gravação novamente.'

/** C199-fix — one request carried more bytes than a chunk may carry. */
export const RECORDING_CHUNK_TOO_LARGE_MESSAGE = 'Uma parte do envio excedeu o tamanho permitido.'

/** C199-fix — the bytes received do not match the declared file size. */
export const RECORDING_UPLOAD_SIZE_MISMATCH_MESSAGE =
  'O envio não corresponde ao tamanho do arquivo informado. Envie a gravação novamente.'

/** C199-fix — the upload session state is gone (restart or manual cleanup). */
export const RECORDING_UPLOAD_SESSION_LOST_MESSAGE =
  'O envio da gravação foi interrompido. Comece de novo.'

/** C199-fix — chunks of a recording that is no longer uploading. */
export const RECORDING_UPLOAD_NOT_IN_PROGRESS_MESSAGE =
  'Este envio de gravação não está mais em andamento.'

/** C199-fix — the server has no disk room for the declared file plus margin. */
export const RECORDING_UPLOAD_NO_SPACE_MESSAGE =
  'Espaço insuficiente no servidor para receber esta gravação. Avise a equipe.'

/** Filename sanity: no path parts, no empties — the temp file keeps the extension. */
const uploadFilename = z
  .string()
  .trim()
  .min(1, RECORDING_FILE_NAME_MESSAGE)
  .max(255, RECORDING_FILE_NAME_MESSAGE)
  .refine((value) => !value.includes('/') && !value.includes('\\'), RECORDING_FILE_NAME_MESSAGE)

/** Metadata of the chunked upload (`POST .../gravacoes/enviar`). */
export const recordingUploadMetadataSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, RECORDING_TITLE_REQUIRED_MESSAGE)
    .max(
      RECORDING_TITLE_MAX_LENGTH,
      `O título deve ter até ${RECORDING_TITLE_MAX_LENGTH} caracteres.`,
    ),
  recordedAt: trimmedOptionalText(32),
  filename: uploadFilename,
  /** Declared size of the whole file; the server finalizes only when it matches. */
  size: z
    .string()
    .trim()
    .regex(/^\d+$/, RECORDING_FILE_SIZE_MESSAGE)
    .transform(Number)
    .refine((value) => Number.isSafeInteger(value) && value >= 0, RECORDING_FILE_SIZE_MESSAGE),
})

export type RecordingUploadMetadata = z.infer<typeof recordingUploadMetadataSchema>

/** Retry the transcription of a failed recording. */
export const recordingRetryRequestSchema = z.object({
  recordingId: z.number().int().positive(),
})

/** C200 — the team names one acoustic cluster of a recording. */
export const RECORDING_SPEAKER_UNKNOWN_MESSAGE =
  'Este agrupamento de falantes não existe mais nesta gravação.'

export const recordingSpeakerLabelRequestSchema = z.object({
  recordingId: z.number().int().positive(),
  speakerKey: z
    .string()
    .trim()
    .regex(/^speaker-\d{1,3}$/, RECORDING_SPEAKER_UNKNOWN_MESSAGE),
  label: z
    .string()
    .trim()
    .min(1, RECORDING_SPEAKER_LABEL_REQUIRED_MESSAGE)
    .max(RECORDING_SPEAKER_LABEL_MAX_LENGTH, RECORDING_SPEAKER_LABEL_LONG_MESSAGE),
})

/** Delete one recording (row + segments + private media). */
export const recordingDeleteRequestSchema = z.object({
  recordingId: z.number().int().positive(),
})

/** Poll the statuses of the visible recordings (bounded batch). */
export const recordingStatusRequestSchema = z.object({
  recordingIds: z.array(z.number().int().positive()).min(1).max(50),
})

export type RecordingStatusRequest = z.infer<typeof recordingStatusRequestSchema>
