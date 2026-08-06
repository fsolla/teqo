import { CitiesByState } from '@/lib/cities'
import { z } from 'zod'

import {
  brazilianMobile,
  optionalPersistedEmail,
  positiveRelationshipId,
} from '@/lib/schemas/primitives'

export type StateKey = keyof typeof CitiesByState

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(120, 'Nome deve ter no máximo 100 caracteres')
    .regex(
      /^(?=.* )[\p{L}\p{M}]+(?:[- ][\p{L}\p{M}]+)*$/u,
      'Informe nome e sobrenome. Use apenas letras, no máximo um espaço ou hífen entre termos, e sem espaço no início ou no fim.',
    ),
  email: z.email('Email inválido'),
  phone: z
    .string()
    .trim()
    .length(11, 'Telefone celular inválido')
    .regex(/^\d{11}$/, 'Telefone celular inválido'),
  state: z.custom<StateKey>(
    (value) => typeof value === 'string' && value in CitiesByState,
    'Estado inválido',
  ),
  city: z.string().trim().min(3, 'Cidade inválida').max(100, 'Cidade muito longa'),
  postalCode: z
    .string()
    .trim()
    .regex(/^(?:\d{8})?$/, 'CEP inválido')
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
})

const contactPhoneInput = z.union([brazilianMobile, z.literal(''), z.null()]).optional()

const nullableContactPhone = contactPhoneInput.transform((value) =>
  value === '' || value === undefined ? null : value,
)

/** Per-field Contact write shared by campaign person joins. */
export const contactFieldUpdateSchema = z.discriminatedUnion('field', [
  z.object({
    id: positiveRelationshipId,
    field: z.literal('name'),
    name: z.string().trim().min(2).max(120),
  }),
  z.object({
    id: positiveRelationshipId,
    field: z.literal('email'),
    email: optionalPersistedEmail,
  }),
  z.object({
    id: positiveRelationshipId,
    field: z.literal('phone'),
    phone: nullableContactPhone,
  }),
])

export type ContactFieldUpdateInput = z.input<typeof contactFieldUpdateSchema>
