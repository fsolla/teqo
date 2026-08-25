import { CitiesByState } from '@/lib/cities'
import { BRAZILIAN_PHONE_DUPLICATE_MESSAGE } from '@/lib/phone'
import { personGenders } from '@/lib/schemas/personGenders'
import { z } from 'zod'

import {
  brazilianMobile,
  optionalPersistedEmail,
  positiveRelationshipId,
} from '@/lib/schemas/primitives'

export type StateKey = keyof typeof CitiesByState

/** Gender enum shared with the leadership collection (same values, C139). */
const contactGenders = personGenders

/**
 * Full-name rule for people records (required across the public and staff
 * flows). Exported so sibling schemas reuse it instead of re-declaring.
 */
export const contactNameSchema = z
  .string()
  .trim()
  .min(2, 'Nome deve ter pelo menos 2 caracteres')
  .max(120, 'Nome deve ter no máximo 100 caracteres')
  .regex(
    /^(?=.* )[\p{L}\p{M}]+(?:[- ][\p{L}\p{M}]+)*$/u,
    'Informe nome e sobrenome. Use apenas letras, no máximo um espaço ou hífen entre termos, e sem espaço no início ou no fim.',
  )

/**
 * UF-of-the-cities-catalog rule (required). Exported so the four ficha schemas
 * reuse the single definition instead of re-declaring the inline predicate
 * (Fase 3 of the S9+ DRY pass — was private until it gained multiple consumers).
 */
export const contactStateSchema = z.custom<StateKey>(
  (value) => typeof value === 'string' && value in CitiesByState,
  'Estado inválido',
)

/**
 * Optional-state variant: the public combobox clears to '' (FormCombobox
 * `onValueChange`), so the union accepts it and collapses ''/undefined.
 */
export const optionalContactStateSchema = z
  .union([contactStateSchema, z.literal('')])
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))

/**
 * Required free-text city rule (trim + min/max with the same messages the ficha
 * schemas already used). Exported so the ficha schemas and the optional variant
 * below share one definition (Fase 3 of the S9+ DRY pass).
 */
export const contactCitySchema = z
  .string()
  .trim()
  .min(3, 'Cidade inválida')
  .max(100, 'Cidade muito longa')

/**
 * Optional free-text city (''/undefined collapse). Composed over `contactCitySchema`
 * so it inherits the same min/max messages, and exported so sibling schemas reuse
 * the same optional-city rule as the ficha's mobile sheet.
 */
export const contactCityFieldSchema = z
  .union([contactCitySchema, z.literal('')])
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))

const contactPostalCodeSchema = z
  .string()
  .trim()
  .regex(/^(?:\d{8})?$/, 'CEP inválido')
  .transform((v) => (v === '' ? undefined : v))
  .optional()

const contactPhoneInput = z.union([brazilianMobile, z.literal(''), z.null()]).optional()

const nullableContactPhone = contactPhoneInput.transform((value) =>
  value === '' || value === undefined ? null : value,
)

/**
 * The ficha's phone list: valid mobiles, never the same number twice within
 * the SAME person (C112 — the mesa blocks it at the form); sharing a number
 * BETWEEN persons stays free (C111). Order = priority (first = primary).
 */
export const contactPhonesSchema = z.array(brazilianMobile).superRefine((phones, context) => {
  if (new Set(phones).size !== phones.length) {
    context.addIssue({
      code: 'custom',
      message: BRAZILIAN_PHONE_DUPLICATE_MESSAGE,
    })
  }
})

export const contactSchema = z.object({
  name: contactNameSchema,
  email: z.email('Email inválido'),
  phone: z
    .string()
    .trim()
    .length(11, 'Telefone celular inválido')
    .regex(/^\d{11}$/, 'Telefone celular inválido'),
  state: contactStateSchema,
  city: contactCitySchema,
  postalCode: contactPostalCodeSchema,
})

/**
 * C139 — the create form of the contacts page: the ficha fields a staff actor
 * fills in one shot (name required and unique — the invariant runs in the
 * action under an advisory lock; phones follow the C112 shape).
 */
export const contactCreateSchema = z.object({
  name: contactNameSchema,
  email: optionalPersistedEmail,
  // Optional like the collection: name-only fichas exist (C111); the form
  // sends [] when the actor typed no phone.
  phones: contactPhonesSchema.optional(),
  gender: z.enum(contactGenders).optional(),
  state: contactStateSchema,
  city: contactCityFieldSchema,
  postalCode: z
    .string()
    .trim()
    .regex(/^(?:\d{8})?$/, 'CEP inválido')
    .optional(),
})

export type ContactCreateInput = z.input<typeof contactCreateSchema>

export const CONTACT_NAME_CONFLICT_MESSAGE =
  'Já existe um contato com este nome — confira a lista antes de salvar.'
export const CONTACT_CELL_STAFF_MESSAGE = 'Apenas a equipe pode editar fichas.'
export const CONTACT_CELL_NOT_IN_SCOPE_MESSAGE = 'Esta ficha não está no seu escopo.'
export const CONTACT_CREATE_STAFF_MESSAGE = 'Apenas a equipe pode criar contatos.'
export const CONTACT_CREATED_MESSAGE = 'Contato criado.'

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
  z.object({
    id: positiveRelationshipId,
    field: z.literal('phones'),
    phones: contactPhonesSchema,
  }),
  // C139 — the select cells commit the ficha's own enum fields: gender (the
  // shared person enum) and state (a UF of the cities catalog).
  z.object({
    id: positiveRelationshipId,
    field: z.literal('gender'),
    gender: z.enum(contactGenders),
  }),
  z.object({
    id: positiveRelationshipId,
    field: z.literal('state'),
    state: contactStateSchema,
  }),
  // C139 — the contacts page edits the ficha's own fields in place: city and
  // CEP are free text on the Contact collection itself (no person-join
  // sibling writes them).
  z.object({
    id: positiveRelationshipId,
    field: z.literal('city'),
    city: contactCitySchema,
  }),
  z.object({
    id: positiveRelationshipId,
    field: z.literal('postalCode'),
    postalCode: contactPostalCodeSchema,
  }),
])

export type ContactFieldUpdateInput = z.input<typeof contactFieldUpdateSchema>

const contactGenderFieldSchema = z
  .union([z.enum(contactGenders), z.literal('')])
  .transform((value) => (value === '' ? undefined : value))
  .optional()

/**
 * C139 — the mobile edit sheet is a SINGLE atomic write (plan decision F):
 * the whole ficha in one schema, with the same gate/scope/name invariant as
 * the per-field ladder; an empty email/CEP/city clears the column (null),
 * an empty gender clears the enum.
 */
export const contactFullUpdateSchema = z.object({
  id: positiveRelationshipId,
  name: contactNameSchema,
  email: optionalPersistedEmail,
  phones: contactPhonesSchema.optional(),
  gender: contactGenderFieldSchema,
  state: contactStateSchema,
  city: contactCityFieldSchema,
  postalCode: contactPostalCodeSchema,
})

export type ContactFullUpdateInput = z.input<typeof contactFullUpdateSchema>
