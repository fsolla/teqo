import { z } from 'zod'

import { RECORDING_TITLE_MAX_LENGTH, RECORDING_TITLE_REQUIRED_MESSAGE } from '@/lib/recording'
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

/** Filename sanity: no path parts, no empties — the temp file keeps the extension. */
const uploadFilename = z
  .string()
  .trim()
  .min(1, RECORDING_FILE_NAME_MESSAGE)
  .max(255, RECORDING_FILE_NAME_MESSAGE)
  .refine((value) => !value.includes('/') && !value.includes('\\'), RECORDING_FILE_NAME_MESSAGE)

/** Metadata of the raw-body upload (`POST .../gravacoes/enviar`). */
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
})

export type RecordingUploadMetadata = z.infer<typeof recordingUploadMetadataSchema>

/** Retry the transcription of a failed recording. */
export const recordingRetryRequestSchema = z.object({
  recordingId: z.number().int().positive(),
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
