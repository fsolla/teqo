import { z } from 'zod'

import { bahiaMunicipalities } from '@/lib/bahiaTerritories'
import {
  brazilianMobile,
  optionalPersistedEmail,
  positiveRelationshipId,
  trimmedNullableText,
} from '@/lib/schemas/primitives'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

export const supporterVoteIntentions = ['certo', 'tende_a_certo', 'indeciso', 'outro'] as const

export type SupporterVoteIntention = (typeof supporterVoteIntentions)[number]

export const isSupporterVoteIntention = (value: unknown): value is SupporterVoteIntention =>
  typeof value === 'string' && (supporterVoteIntentions as readonly string[]).includes(value)

const canonicalMunicipalityBySearchValue = new Map(
  bahiaMunicipalities.map((city) => [normalizeSearchPhrase(city), city]),
)

export const resolveBahiaMunicipality = (value: string | undefined | null): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return canonicalMunicipalityBySearchValue.get(normalizeSearchPhrase(trimmed)) ?? null
}

const optionalBahiaCity = z
  .union([z.string().trim(), z.literal(''), z.null()])
  .optional()
  .transform((value, context) => {
    if (value === undefined || value === null || value === '') return undefined
    const city = resolveBahiaMunicipality(value)
    if (!city) {
      context.addIssue({
        code: 'custom',
        message: 'Município não reconhecido na Bahia.',
      })
      return z.NEVER
    }
    return city
  })

export const supporterCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: brazilianMobile,
    email: optionalPersistedEmail,
    city: optionalBahiaCity,
    municipality: positiveRelationshipId.optional(),
    voteIntention: z.enum(supporterVoteIntentions).optional(),
    consentAccepted: z.literal(true, {
      error: 'É necessário aceitar o consentimento de cadastro.',
    }),
    voteIntentionConsentAccepted: z.boolean().optional(),
  })
  .superRefine((data, context) => {
    if (data.voteIntention && !data.voteIntentionConsentAccepted) {
      context.addIssue({
        code: 'custom',
        path: ['voteIntentionConsentAccepted'],
        message: 'É necessário aceitar o consentimento de intenção de voto.',
      })
    }
  })

export const supporterVoteIntentionSchema = z.object({
  id: positiveRelationshipId,
  voteIntention: z.enum(supporterVoteIntentions),
  voteIntentionConsentAccepted: z.literal(true, {
    error: 'É necessário aceitar o consentimento de intenção de voto.',
  }),
})

export const supporterImportConfirmSchema = z.object({
  operatorAttested: z.literal(true, {
    error: 'É necessário atestar o consentimento dos apoiadores importados.',
  }),
  consentNote: trimmedNullableText(2000),
  importToken: z.string().min(1, { error: 'Token de importação ausente.' }),
})

export const leaderSupporterCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: brazilianMobile,
  city: optionalBahiaCity,
  municipality: positiveRelationshipId,
  consentAccepted: z.literal(true, {
    error: 'É necessário aceitar o consentimento de cadastro.',
  }),
})

export const supporterRemoveSchema = z.object({
  id: positiveRelationshipId,
})

export type SupporterCreateInput = z.input<typeof supporterCreateSchema>
export type LeaderSupporterCreateInput = z.input<typeof leaderSupporterCreateSchema>
export type SupporterVoteIntentionInput = z.input<typeof supporterVoteIntentionSchema>
export type SupporterImportConfirmInput = z.input<typeof supporterImportConfirmSchema>
