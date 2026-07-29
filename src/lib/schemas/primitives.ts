import { z } from 'zod'

import { BRAZILIAN_PHONE_INVALID_MESSAGE, normalizeBrazilianPhone } from '@/lib/phone'

export const positiveRelationshipId = z.number().int().positive()

export const trimmedOptionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => (value === '' ? undefined : value))

export const trimmedNullableText = (maximum: number) =>
  z
    .union([z.string().trim().max(maximum), z.null()])
    .optional()
    .transform((value) => (value === '' ? null : value))

export const brazilianMobile = z.string().transform((value, context) => {
  const phone = normalizeBrazilianPhone(value)
  if (phone) return phone

  context.addIssue({
    code: 'custom',
    message: BRAZILIAN_PHONE_INVALID_MESSAGE,
  })
  return z.NEVER
})

export const optionalPersistedEmail = z
  .union([z.email('E-mail inválido.'), z.literal('')])
  .optional()
  .transform((value) => (value === '' ? undefined : value))

export const nullablePersistedEmail = z
  .union([z.email('E-mail inválido.'), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === '' ? null : value))

/** Upper bound for any vote count field — one bound, two validation layers (P3-K, was 1_000_000 spelled ×6). */
export const MAX_VOTE_COUNT = 1_000_000
