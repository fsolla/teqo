import { z } from 'zod'

import { normalizeBrazilianPhone } from '@/lib/phone'

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
    message: 'Celular brasileiro inválido.',
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
