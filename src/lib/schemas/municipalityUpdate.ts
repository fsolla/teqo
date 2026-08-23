import { z } from 'zod'

import { MAX_VOTE_COUNT, positiveRelationshipId } from '@/lib/schemas/primitives'

export const municipalityUpdatePolarities = ['boa', 'neutra', 'ruim'] as const
export type MunicipalityUpdatePolarity = (typeof municipalityUpdatePolarities)[number]

export const municipalityUpdatePolarityLabels: Record<MunicipalityUpdatePolarity, string> = {
  boa: 'Boa',
  neutra: 'Neutra',
  ruim: 'Ruim',
}

/** Polarity → Badge variant, single-sourced for every feed that renders it. */
export const municipalityUpdatePolarityBadgeVariant: Record<
  MunicipalityUpdatePolarity,
  'default' | 'secondary' | 'destructive'
> = {
  boa: 'default',
  neutra: 'secondary',
  ruim: 'destructive',
}

export const MUNICIPALITY_UPDATE_POLARITY_REQUIRED_MESSAGE = 'Informe a polaridade da atualização.'

export const MUNICIPALITY_UPDATE_BODY_REQUIRED_MESSAGE = 'Informe o texto da atualização.'

export const parseMunicipalityUpdatePolarity = (
  raw: string | undefined,
): MunicipalityUpdatePolarity | undefined => {
  if (!raw) return undefined
  return municipalityUpdatePolarities.includes(raw as MunicipalityUpdatePolarity)
    ? (raw as MunicipalityUpdatePolarity)
    : undefined
}

const optionalCount = z.number().int().min(0).max(MAX_VOTE_COUNT).optional()

export const municipalityUpdateCreateSchema = z.object({
  municipality: positiveRelationshipId,
  body: z.string().trim().min(1, MUNICIPALITY_UPDATE_BODY_REQUIRED_MESSAGE).max(5000),
  polarity: z.enum(municipalityUpdatePolarities),
  urgent: z.boolean().default(false),
  activeVolunteers: optionalCount,
  newSupports: optionalCount,
  adversarySignal: z.boolean().default(false),
})

export type MunicipalityUpdateCreateInput = z.input<typeof municipalityUpdateCreateSchema>

export const MUNICIPALITY_UPDATE_COMMENT_MAX_LENGTH = 4000

const MUNICIPALITY_UPDATE_COMMENT_REQUIRED_MESSAGE = 'Escreva o comentário antes de enviar.'

const MUNICIPALITY_UPDATE_COMMENT_TOO_LONG_MESSAGE = `O comentário deve ter no máximo ${MUNICIPALITY_UPDATE_COMMENT_MAX_LENGTH} caracteres.`

export const MUNICIPALITY_UPDATE_NO_MUNICIPALITY_MESSAGE =
  'Atualização sem município não pode ter responsável.'

export const MUNICIPALITY_UPDATE_RESPONSIBLE_NOT_ELIGIBLE_MESSAGE =
  'Este usuário não pode ser responsável: escolha um assessor do município ou a coordenação.'

export const municipalityUpdateCommentSchema = z.object({
  updateId: positiveRelationshipId,
  body: z
    .string()
    .trim()
    .min(1, MUNICIPALITY_UPDATE_COMMENT_REQUIRED_MESSAGE)
    .max(MUNICIPALITY_UPDATE_COMMENT_MAX_LENGTH, MUNICIPALITY_UPDATE_COMMENT_TOO_LONG_MESSAGE),
})

export const municipalityUpdateResponsibleSchema = z.object({
  updateId: positiveRelationshipId,
  /** `null` clears the assignee — every fact may also be ownerless. */
  responsibleId: positiveRelationshipId.nullable(),
})

export const municipalityUpdateResolveSchema = z.object({
  updateId: positiveRelationshipId,
})

export type MunicipalityUpdateResponsibleInput = z.input<typeof municipalityUpdateResponsibleSchema>

export type MunicipalityUpdateCommentInput = z.input<typeof municipalityUpdateCommentSchema>
