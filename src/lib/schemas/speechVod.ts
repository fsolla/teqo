import { z } from 'zod'

import { positiveRelationshipId } from '@/lib/schemas/primitives'

/** The detail page asks the server to resolve one speech's excerpt VOD. */
export const speechVodRequestSchema = z.object({
  speechId: positiveRelationshipId,
})

/**
 * Safe messages of the resolution route — shared constants on purpose:
 * `mapCampaignFormActionError` matches by exact string, so a literal at one
 * end only would silently collapse a real refusal into the generic error.
 */

/** The catalog gate (`canReadCommunicationCatalog`) refused the actor. */
export const SPEECH_VOD_FORBIDDEN_MESSAGE = 'Você não tem acesso ao acervo de falas.'

/** The speech does not exist (or the actor cannot read it). */
export const SPEECH_VOD_NOT_FOUND_MESSAGE = 'Fala não encontrada.'

/** No stored VOD or missing `eventId`/`audioId`/`excerptTMs` — never call the Câmara. */
export const SPEECH_VOD_INELIGIBLE_MESSAGE =
  'Esta fala não tem trecho de vídeo para resolver na Câmara.'

/** Transport/parse failure at the Câmara (or anything unmapped). */
export const SPEECH_VOD_GENERIC_ERROR_MESSAGE =
  'Não foi possível resolver o trecho. Verifique seu acesso e tente novamente.'
