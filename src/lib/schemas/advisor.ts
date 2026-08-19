import { z } from 'zod'

import {
  ADVISOR_EDITING_VALUES,
  ADVISOR_VISIBILITY_VALUES,
  isCoherentAdvisorProfile,
} from '@/lib/campaignAdvisorProfile'
import {
  MAX_MUNICIPALITIES_PER_BATCH,
  MUNICIPALITY_ADVISORS_CAP_MESSAGE,
} from '@/lib/schemas/municipality'
import {
  advisorNameSchema,
  brazilianMobile,
  optionalPersistedEmail,
  positiveRelationshipId,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'
import { slugify } from '@/lib/slug'

const PLANILHA_INVALID_EMAIL_SUFFIX = '@planilha.invalid'
const INLINE_STUB_EMAIL_SUFFIX = '@criado.invalid'

/**
 * Seed (`@planilha.invalid`, E4R) and inline-created (`@criado.invalid`, B154)
 * stub emails — non-routable placeholders that mark a not-yet-activated
 * account. Shared by the password-reset guard (`PLACEHOLDER_RESET_MESSAGE`) and
 * the advisors list e-mail cell, so an inline-created account behaves exactly
 * like a seeded one until a coordinator swaps in real credentials.
 */
export const isPlanilhaPlaceholderEmail = (email: string | null | undefined): boolean =>
  typeof email === 'string' &&
  (email.trim().toLowerCase().endsWith(PLANILHA_INVALID_EMAIL_SUFFIX) ||
    email.trim().toLowerCase().endsWith(INLINE_STUB_EMAIL_SUFFIX))

/** Stable seed-style placeholder used when the e-mail field is cleared in the list UI. */
export const planilhaPlaceholderEmailForAdvisor = (advisorId: number): string =>
  `assessor-${advisorId}${PLANILHA_INVALID_EMAIL_SUFFIX}`

/**
 * Inline-create stub (B154): `<slug-do-nome>@criado.invalid`, `-N` from the
 * second occurrence — `campaignUser.email` is unique while `name` is not, so
 * two advisors whose names slugify identically get distinct stubs. Same
 * deterministic pattern as the E4R seed; `name` is only the input to `slugify`.
 */
export const stubCampaignUserEmailFor = (name: string, occurrence = 1): string => {
  const localPart = slugify(name) || 'assessor'
  return `${localPart}${occurrence > 1 ? `-${occurrence}` : ''}${INLINE_STUB_EMAIL_SUFFIX}`
}

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

export const ADVISOR_PROFILE_COHERENCE_MESSAGE = 'Edição "Tudo" exige Visão "Tudo".'

export const ADVISOR_ACTION_SAFE_MESSAGES = [
  ADVISOR_UNRESTRICTED_MESSAGE,
  ADVISOR_EMAIL_CONFLICT_MESSAGE,
  PLACEHOLDER_RESET_MESSAGE,
  ADVISOR_ROLE_REQUIRED_MESSAGE,
  ADVISOR_SELF_ACCOUNT_MESSAGE,
  MUNICIPALITY_ADVISORS_CAP_MESSAGE,
  ADVISOR_PROFILE_COHERENCE_MESSAGE,
] as const

/**
 * C141 — the advisor permission profile (Visão × Edição). Values come from the
 * single vocabulary in `campaignAdvisorProfile.ts`; the incoherent combination
 * (Edição "Tudo" without Visão "Tudo") is rejected here AND by the collection's
 * `enforceCoherentAdvisorProfile` beforeValidate hook (REST/admin included).
 */
const advisorVisibilitySchema = z.enum(ADVISOR_VISIBILITY_VALUES)

const advisorEditingSchema = z.enum(ADVISOR_EDITING_VALUES)

export const advisorCreateSchema = z.object({
  name: advisorNameSchema,
  email: z.email('E-mail inválido.'),
  phone: optionalAdvisorPhone,
  visibility: advisorVisibilitySchema.default('carteira'),
  editing: advisorEditingSchema.default('carteira'),
})

export const advisorPermissionUpdateSchema = z
  .object({
    id: positiveRelationshipId,
    visibility: advisorVisibilitySchema,
    editing: advisorEditingSchema,
  })
  .refine((value) => isCoherentAdvisorProfile(value.visibility, value.editing), {
    message: ADVISOR_PROFILE_COHERENCE_MESSAGE,
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
export type AdvisorPermissionUpdateInput = z.input<typeof advisorPermissionUpdateSchema>
