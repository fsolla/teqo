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
