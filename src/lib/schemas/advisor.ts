import { z } from 'zod'

import {
  MAX_MUNICIPALITIES_PER_BATCH,
  MUNICIPALITY_ADVISORS_CAP_MESSAGE,
} from '@/lib/schemas/municipality'
import {
  brazilianMobile,
  optionalPersistedEmail,
  positiveRelationshipId,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

const PLANILHA_INVALID_EMAIL_SUFFIX = '@planilha.invalid'

export const isPlanilhaPlaceholderEmail = (email: string | null | undefined): boolean =>
  typeof email === 'string' && email.trim().toLowerCase().endsWith(PLANILHA_INVALID_EMAIL_SUFFIX)

/** Stable seed-style placeholder used when the e-mail field is cleared in the list UI. */
export const planilhaPlaceholderEmailForAdvisor = (advisorId: number): string =>
  `assessor-${advisorId}${PLANILHA_INVALID_EMAIL_SUFFIX}`

const advisorPhoneInput = z.union([brazilianMobile, z.literal(''), z.null()]).optional()

const optionalAdvisorPhone = advisorPhoneInput.transform((value) =>
  value === '' || value === null || value === undefined ? undefined : value,
)

const nullableAdvisorPhone = advisorPhoneInput.transform((value) =>
  value === '' || value === undefined ? null : value,
)

export const PLACEHOLDER_RESET_MESSAGE =
  'Troque o e-mail placeholder da planilha por um e-mail real antes de enviar o link de senha.'

export const ADVISOR_UNRESTRICTED_MESSAGE =
  'Somente a coordenação geral ou o candidato gerencia assessores.'

export const ADVISOR_EMAIL_CONFLICT_MESSAGE = 'Já existe uma conta com este e-mail.'

/** Same exact-string contract: refused writes on another account's role/self. */
export const ADVISOR_ROLE_REQUIRED_MESSAGE =
  'Só é possível gerenciar contas com papel de Assessor nesta tela.'
export const ADVISOR_SELF_ACCOUNT_MESSAGE = 'Use Meu perfil para alterar a própria conta.'

export const ADVISOR_ACTION_SAFE_MESSAGES = [
  ADVISOR_UNRESTRICTED_MESSAGE,
  ADVISOR_EMAIL_CONFLICT_MESSAGE,
  PLACEHOLDER_RESET_MESSAGE,
  ADVISOR_ROLE_REQUIRED_MESSAGE,
  ADVISOR_SELF_ACCOUNT_MESSAGE,
  MUNICIPALITY_ADVISORS_CAP_MESSAGE,
] as const

export const advisorCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.email('E-mail inválido.'),
  phone: optionalAdvisorPhone,
})

export const advisorProfileUpdateSchema = z
  .object({
    id: positiveRelationshipId,
    name: trimmedOptionalText(160),
    email: optionalPersistedEmail,
    phone: nullableAdvisorPhone,
  })
  .refine(
    (value) => value.name !== undefined || value.email !== undefined || value.phone !== undefined,
    { message: 'Informe ao menos um campo para atualizar.' },
  )

export const advisorMunicipalitiesBatchSchema = z.object({
  advisorId: positiveRelationshipId,
  // Dedup at the boundary (P3-K): the action used to re-spell `[...new Set(…)]`.
  municipalityIds: z
    .array(positiveRelationshipId)
    .min(1)
    .max(MAX_MUNICIPALITIES_PER_BATCH)
    .transform((ids) => [...new Set(ids)]),
  assigned: z.boolean(),
})

export const advisorPasswordResetSchema = z.object({
  advisorId: positiveRelationshipId,
})

export type AdvisorCreateInput = z.input<typeof advisorCreateSchema>
export type AdvisorProfileUpdateInput = z.input<typeof advisorProfileUpdateSchema>
export type AdvisorMunicipalitiesBatchInput = z.input<typeof advisorMunicipalitiesBatchSchema>
export type AdvisorPasswordResetInput = z.input<typeof advisorPasswordResetSchema>
