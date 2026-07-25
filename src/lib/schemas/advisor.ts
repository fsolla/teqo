import { z } from 'zod'

import { MAX_ADVISORS_PER_MUNICIPALITY } from '@/lib/schemas/municipality'
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

export const ADVISOR_ACTION_SAFE_MESSAGES = [
  ADVISOR_UNRESTRICTED_MESSAGE,
  ADVISOR_EMAIL_CONFLICT_MESSAGE,
  PLACEHOLDER_RESET_MESSAGE,
  'Só é possível gerenciar contas com papel de Assessor nesta tela.',
  'Use Meu perfil para alterar a própria conta.',
  `Cada município aceita no máximo ${MAX_ADVISORS_PER_MUNICIPALITY} assessores.`,
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

export const advisorMunicipalityMembershipSchema = z.object({
  advisorId: positiveRelationshipId,
  municipalityId: positiveRelationshipId,
  assigned: z.boolean(),
})

export const advisorMunicipalitiesBatchSchema = z.object({
  advisorId: positiveRelationshipId,
  municipalityIds: z.array(positiveRelationshipId).min(1).max(435),
  assigned: z.boolean(),
})

export const advisorPasswordResetSchema = z.object({
  advisorId: positiveRelationshipId,
})

export type AdvisorCreateInput = z.input<typeof advisorCreateSchema>
export type AdvisorProfileUpdateInput = z.input<typeof advisorProfileUpdateSchema>
export type AdvisorMunicipalityMembershipInput = z.input<typeof advisorMunicipalityMembershipSchema>
export type AdvisorMunicipalitiesBatchInput = z.input<typeof advisorMunicipalitiesBatchSchema>
export type AdvisorPasswordResetInput = z.input<typeof advisorPasswordResetSchema>
