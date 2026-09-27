import { z } from 'zod'

import { FACE_SEARCH_DESCRIPTOR_LENGTH, FACE_SEARCH_INTENTS } from '@/lib/faceSearch'

/**
 * C234 — wire contract of the public `POST /api/fotos/selfie`. Strict object:
 * an extra key is a malformed body, never a silently ignored one. The vector
 * must be exactly the on-device descriptor (finite numbers — Zod rejects NaN
 * and Infinity natively); the intent names the only two actions the endpoint
 * performs. There is no image field and no identity field — by construction.
 */
export const faceSearchRequestSchema = z.strictObject({
  vector: z.array(z.number()).length(FACE_SEARCH_DESCRIPTOR_LENGTH),
  intent: z.enum(FACE_SEARCH_INTENTS),
})
