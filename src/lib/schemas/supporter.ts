import { z } from 'zod'

import { resolveMunicipalityName } from '@/lib/municipalityNameAliases'
import {
  brazilianMobile,
  optionalPersistedEmail,
  positiveRelationshipId,
  trimmedNullableText,
} from '@/lib/schemas/primitives'

/**
 * Refusal messages matched by exact string in the routes' `safeMessages` —
 * named once (B32+/B37 contract): a reworded literal at either end silently
 * collapses the refusal into the generic error.
 */
export const SUPPORTER_STAFF_MESSAGE =
  'Somente a coordenação e a assessoria podem gerenciar apoiadores.'
export const SUPPORTER_UNSCOPED_COORDINATOR_MESSAGE =
  'Somente o Coordenador Geral pode cadastrar apoiadores sem município.'
export const SUPPORTER_DUPLICATE_MESSAGE =
  'Esta pessoa já está cadastrada como apoiador neste município.'
export const LEADER_SUPPORTER_ONLY_MESSAGE = 'Somente lideranças podem cadastrar contatos por aqui.'
export const SUPPORTER_IMPORT_CSV_UNREADABLE_MESSAGE =
  'Não foi possível ler o CSV. Verifique o formato e tente novamente.'
export const SUPPORTER_IMPORT_CSV_EMPTY_MESSAGE = 'O CSV está vazio.'
export const SUPPORTER_IMPORT_BATCH_EMPTY_MESSAGE =
  'O lote de importação não contém apoiadores válidos.'

/** Same contract for the two parameterized import refusals — builders, so the limit and the column policy are spelled once. */
export const supporterImportCsvTooManyRowsMessage = (maxRows: number): string =>
  `O CSV excede o limite de ${maxRows} linhas.`

export const supporterImportCsvUnknownColumnsMessage = (unknownColumns: string[]): string =>
  `Colunas não reconhecidas no CSV: ${unknownColumns
    .map((column) => column.replace(/^__unknown_/, ''))
    .join(', ')}. Use apenas nome, telefone, municipio e intencao.`

const supporterVoteIntentions = ['certo', 'tende_a_certo', 'indeciso', 'outro'] as const

export type SupporterVoteIntention = (typeof supporterVoteIntentions)[number]

export const isSupporterVoteIntention = (value: unknown): value is SupporterVoteIntention =>
  typeof value === 'string' && (supporterVoteIntentions as readonly string[]).includes(value)

export const resolveBahiaMunicipality = resolveMunicipalityName

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
