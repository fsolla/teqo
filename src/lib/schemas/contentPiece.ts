import { z } from 'zod'

import {
  CONTENT_PIECE_DESCRIPTION_MAX_LENGTH,
  CONTENT_PIECE_INSTITUTION_MAX_LENGTH,
  CONTENT_PIECE_LEADERS_MAX,
  CONTENT_PIECE_PUBLIC_FIGURES_MAX,
  CONTENT_PIECE_PUBLIC_FIGURE_MAX_LENGTH,
  CONTENT_PIECE_TEXT_TOO_LARGE_MESSAGE,
  CONTENT_PIECE_TITLE_MAX_LENGTH,
  CONTENT_PIECE_TYPES,
} from '@/lib/contentPiece'
import { trimmedNullableText } from '@/lib/schemas/primitives'
import { TRANSCRIPT_TEXT_MAX_LENGTH } from '@/lib/speechSearch'

/** The Central gate refused the actor — one literal shared with the vertical. */
export const CONTENT_PIECE_FORBIDDEN_MESSAGE = 'Seu perfil não tem acesso à Central de Conteúdos.'

/** The piece does not exist (or the actor cannot read it). */
export const CONTENT_PIECE_NOT_FOUND_MESSAGE = 'Peça não encontrada.'

/** Retry only applies to a failed piece. */
export const CONTENT_PIECE_RETRY_NOT_FAILED_MESSAGE =
  'Só é possível reprocessar uma peça que falhou.'

/** Transport/storage failure (or anything unmapped) of a JSON action. */
export const CONTENT_PIECE_GENERIC_ERROR_MESSAGE =
  'Não foi possível concluir a ação. Verifique seu acesso e tente novamente.'

/** The pasted link is not an Instagram/YouTube publication. */
export const CONTENT_PIECE_LINK_INVALID_MESSAGE = 'Cole um link do Instagram ou do YouTube.'

/** The same link is already catalogued (the `sourceUrl` unique constraint). */
export const CONTENT_PIECE_LINK_DUPLICATE_MESSAGE = 'Esta peça já está na Central.'

/** The upload arrived without a usable file name (a field error). */
const CONTENT_PIECE_FILE_NAME_MESSAGE = 'Nome de arquivo inválido.'

/** The picked file is outside the four families the Central catalogues. */
export const CONTENT_PIECE_FILE_TYPE_MESSAGE = 'Envie um vídeo, um áudio, uma foto ou um texto.'

/** The raw-body upload arrived without a body (shared with the upload module). */
export const CONTENT_PIECE_BODY_MISSING_MESSAGE = 'A requisição não trouxe o arquivo da peça.'

/** The stream guard's ceiling refusal (the picker's per-file copy is dynamic). */
export const CONTENT_PIECE_UPLOAD_TOO_LARGE_MESSAGE = 'O arquivo excede o limite de 4 GB.'

/** "Anexar arquivo original" on a piece that already has a file. */
export const CONTENT_PIECE_MEDIA_ALREADY_ATTACHED_MESSAGE = 'Esta peça já tem um arquivo original.'

/** The ficha sent a type outside the vocabulary. */
export const CONTENT_PIECE_TYPE_INVALID_MESSAGE = 'Tipo de peça inválido.'

/** The ficha saved an empty title (a field error, never a safe wire message). */
const CONTENT_PIECE_TITLE_REQUIRED_MESSAGE = 'Informe um título para a peça.'

/** Filename sanity: no path parts, no empties — the temp file keeps the extension. */
const uploadFilename = z
  .string()
  .trim()
  .min(1, CONTENT_PIECE_FILE_NAME_MESSAGE)
  .max(255, CONTENT_PIECE_FILE_NAME_MESSAGE)
  .refine((value) => !value.includes('/') && !value.includes('\\'), CONTENT_PIECE_FILE_NAME_MESSAGE)

/** Metadata of the raw-body upload (`POST .../conteudos/enviar`). */
export const contentPieceUploadMetadataSchema = z.object({
  filename: uploadFilename,
})

export type ContentPieceUploadMetadata = z.infer<typeof contentPieceUploadMetadataSchema>

/** Add a piece by link (Instagram/YouTube). */
export const contentPieceLinkRequestSchema = z.object({
  url: z.string().trim().min(1, CONTENT_PIECE_LINK_INVALID_MESSAGE),
})

/** The editable catalogue of one piece (the ficha form). */
export const contentPieceUpdateRequestSchema = z.object({
  contentPieceId: z.number().int().positive(),
  title: z
    .string()
    .trim()
    .min(1, CONTENT_PIECE_TITLE_REQUIRED_MESSAGE)
    .max(
      CONTENT_PIECE_TITLE_MAX_LENGTH,
      `O título deve ter até ${CONTENT_PIECE_TITLE_MAX_LENGTH} caracteres.`,
    ),
  description: trimmedNullableText(CONTENT_PIECE_DESCRIPTION_MAX_LENGTH),
  type: z.enum(CONTENT_PIECE_TYPES),
  pieceDate: trimmedNullableText(32),
  // Kept as raw tokens: the action filters them against the taxonomy and the
  // field counts as curated whenever the form carried it at all.
  topics: z.array(z.string()).max(32).optional(),
  municipalityId: z.number().int().positive().nullable().optional(),
  institution: trimmedNullableText(CONTENT_PIECE_INSTITUTION_MAX_LENGTH),
  transcript: trimmedNullableText(TRANSCRIPT_TEXT_MAX_LENGTH),
  // S37 — who appears in the piece: the leader relation ids and the curated
  // public figures. The action canonicalizes the figures against the catalog.
  leaderIds: z.array(z.number().int().positive()).max(CONTENT_PIECE_LEADERS_MAX).optional(),
  publicFigures: z
    .array(z.string().trim().max(CONTENT_PIECE_PUBLIC_FIGURE_MAX_LENGTH))
    .max(CONTENT_PIECE_PUBLIC_FIGURES_MAX)
    .optional(),
})

export type ContentPieceUpdateRequest = z.infer<typeof contentPieceUpdateRequestSchema>

/** Retry the processing of a failed piece. */
export const contentPieceRetryRequestSchema = z.object({
  contentPieceId: z.number().int().positive(),
})

/** Delete one piece for good (row + its private media file). */
export const contentPieceDeleteRequestSchema = z.object({
  contentPieceId: z.number().int().positive(),
})

/** Poll the statuses of the visible pieces (bounded batch). */
export const contentPieceStatusRequestSchema = z.object({
  contentPieceIds: z.array(z.number().int().positive()).min(1).max(50),
})

export type ContentPieceStatusRequest = z.infer<typeof contentPieceStatusRequestSchema>

/** The kill switch of one piece. */
export const contentPiecePublicationRequestSchema = z.object({
  contentPieceId: z.number().int().positive(),
  published: z.boolean(),
})

/** Attach the original file to a link piece. */
export const contentPieceAttachRequestSchema = z.object({
  contentPieceId: z.number().int().positive(),
  filename: uploadFilename,
})

/**
 * The domain messages the JSON routes and the ficha form are allowed to pass
 * through verbatim (everything else collapses to the generic one).
 */
export const CONTENT_PIECE_SAFE_MESSAGES = [
  CONTENT_PIECE_FORBIDDEN_MESSAGE,
  CONTENT_PIECE_NOT_FOUND_MESSAGE,
  CONTENT_PIECE_RETRY_NOT_FAILED_MESSAGE,
  CONTENT_PIECE_LINK_INVALID_MESSAGE,
  CONTENT_PIECE_LINK_DUPLICATE_MESSAGE,
  CONTENT_PIECE_MEDIA_ALREADY_ATTACHED_MESSAGE,
  CONTENT_PIECE_TYPE_INVALID_MESSAGE,
] as const

/**
 * The messages the two raw-body piece routes (upload and attach) may return
 * verbatim; the JSON routes use `CONTENT_PIECE_SAFE_MESSAGES` alone.
 */
export const CONTENT_PIECE_UPLOAD_SAFE_MESSAGES = [
  ...CONTENT_PIECE_SAFE_MESSAGES,
  CONTENT_PIECE_FILE_TYPE_MESSAGE,
  CONTENT_PIECE_BODY_MISSING_MESSAGE,
  CONTENT_PIECE_UPLOAD_TOO_LARGE_MESSAGE,
  CONTENT_PIECE_TEXT_TOO_LARGE_MESSAGE,
] as const
