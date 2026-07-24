import { z } from 'zod'

import {
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

export const organizationKinds = [
  'sindicato',
  'associacao',
  'religioso',
  'movimento',
  'categoria_profissional',
  'outro',
] as const

export type OrganizationKind = (typeof organizationKinds)[number]

export const organizationKindLabels: Record<OrganizationKind, string> = {
  sindicato: 'Sindicato',
  associacao: 'Associação',
  religioso: 'Religiosa',
  movimento: 'Movimento',
  categoria_profissional: 'Categoria profissional',
  outro: 'Outro',
}

const municipalitiesArraySchema = z
  .array(positiveRelationshipId)
  .max(50)
  .transform((ids) => [...new Set(ids)])

export const organizationCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  kind: z.enum(organizationKinds),
  notes: trimmedOptionalText(4000),
  municipalities: municipalitiesArraySchema.optional(),
})

export const organizationUpdateSchema = z.object({
  id: positiveRelationshipId,
  kind: z.enum(organizationKinds).optional(),
  notes: trimmedNullableText(4000),
  municipalities: municipalitiesArraySchema.optional(),
})

export type OrganizationCreateInput = z.input<typeof organizationCreateSchema>
export type OrganizationUpdateInput = z.input<typeof organizationUpdateSchema>
