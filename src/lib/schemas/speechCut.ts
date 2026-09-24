import { z } from 'zod'

import { positiveRelationshipId } from '@/lib/schemas/primitives'
import { SPEECH_VOD_FORBIDDEN_MESSAGE } from '@/lib/schemas/speechVod'
import { SPEECH_CUT_DESCRIPTION_MAX_LENGTH, SPEECH_CUT_TITLE_MAX_LENGTH } from '@/lib/speechCut'

/** The acervo gate refused the actor — one literal shared with C162/C166. */
export const SPEECH_CUT_FORBIDDEN_MESSAGE = SPEECH_VOD_FORBIDDEN_MESSAGE

/** The speech does not exist (or the actor cannot read it). */
export const SPEECH_CUT_SPEECH_NOT_FOUND_MESSAGE = 'Fala não encontrada.'

/** C217 — a web speech without the mirrored file cannot be cut (question 3). */
export const SPEECH_CUT_MIRROR_MISSING_MESSAGE = 'Esta fala não tem arquivo espelhado para cortar.'

/** The cut does not exist (or the actor cannot read it). */
export const SPEECH_CUT_NOT_FOUND_MESSAGE = 'Corte não encontrado.'

/** Selection below the 5 s minimum or outside the speech duration. */
export const SPEECH_CUT_INVALID_RANGE_MESSAGE =
  'Selecione um trecho de 5 segundos até o fim da fala.'

/** Retry only applies to a failed cut — a published one is not re-cut. */
export const SPEECH_CUT_RETRY_NOT_FAILED_MESSAGE =
  'Só é possível tentar novamente um corte que falhou.'

/** Publish is refused until the job stored the MP4 (processing/failed have none). */
export const SPEECH_CUT_PUBLISH_NOT_READY_MESSAGE =
  'Este corte ainda não tem um arquivo para publicar.'

/** Transport/ffmpeg/storage failure (or anything unmapped). */
export const SPEECH_CUT_GENERIC_ERROR_MESSAGE =
  'Não foi possível preparar o corte. Verifique seu acesso e tente novamente.'

const excerptBoundarySeconds = z.number().int().min(0).max(86_400)

/** Create one cut from a C166 selection, or retry the failed row (`retryOf`). */
export const speechCutRequestSchema = z.union([
  z.object({ retryOf: positiveRelationshipId }),
  z.object({
    speechId: positiveRelationshipId,
    startSeconds: excerptBoundarySeconds,
    endSeconds: excerptBoundarySeconds,
    title: z.string().trim().min(1).max(SPEECH_CUT_TITLE_MAX_LENGTH),
    description: z.string().trim().min(1).max(SPEECH_CUT_DESCRIPTION_MAX_LENGTH),
  }),
])

export type SpeechCutRequest = z.infer<typeof speechCutRequestSchema>

/** Poll one running cut. */
export const speechCutStatusRequestSchema = z.object({
  cutId: positiveRelationshipId,
})

/** C183 — a bare cut id: the delete body and the library retry body. */
export const speechCutCutIdRequestSchema = z.object({
  cutId: positiveRelationshipId,
})

export type SpeechCutCutIdRequest = z.infer<typeof speechCutCutIdRequestSchema>

/** AI title/description suggestion for the picked window. */
export const speechCutSuggestionRequestSchema = z.object({
  speechId: positiveRelationshipId,
  startSeconds: excerptBoundarySeconds,
  endSeconds: excerptBoundarySeconds,
})

/** C168 — edit the cut's own text: never the source speech nor the stored video. */
export const speechCutTextUpdateRequestSchema = z.object({
  cutId: positiveRelationshipId,
  title: z.string().trim().min(1).max(SPEECH_CUT_TITLE_MAX_LENGTH),
  description: z.string().trim().min(1).max(SPEECH_CUT_DESCRIPTION_MAX_LENGTH),
})

export type SpeechCutTextUpdateRequest = z.infer<typeof speechCutTextUpdateRequestSchema>

/** C168 — the kill switch: publish/unpublish the cut's public link. */
export const speechCutPublicationRequestSchema = z.object({
  cutId: positiveRelationshipId,
  published: z.boolean(),
})

export type SpeechCutPublicationRequest = z.infer<typeof speechCutPublicationRequestSchema>
