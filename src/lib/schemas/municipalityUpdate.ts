import { z } from 'zod'

import { OPS_UPDATED_AT_CONFLICT_MESSAGE, optionalBaseUpdatedAtSchema } from '@/lib/schemas/opsCas'
import {
  MAX_VOTE_COUNT,
  positiveRelationshipId,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

export const municipalityUpdateKinds = ['semanal', 'urgente', 'nota', 'sinal'] as const
export type MunicipalityUpdateKind = (typeof municipalityUpdateKinds)[number]

export const municipalityUpdateKindLabels: Record<MunicipalityUpdateKind, string> = {
  semanal: 'Semanal',
  urgente: 'Urgente',
  nota: 'Nota',
  sinal: 'Sinal',
}

export const municipalitySignalTypes = [
  'invasao',
  'esfriamento',
  'visita_adversario',
  'proposta_broker',
  'outro',
] as const
export type MunicipalitySignalType = (typeof municipalitySignalTypes)[number]

export const municipalitySignalTypeLabels: Record<MunicipalitySignalType, string> = {
  invasao: 'Invasão',
  esfriamento: 'Rede esfriou',
  visita_adversario: 'Adversário apareceu',
  proposta_broker: 'Alguém pediu algo',
  outro: 'Outro',
}

export const municipalitySignalTypeDescriptions: Record<MunicipalitySignalType, string> = {
  invasao: 'Adversário ocupando nosso espaço.',
  esfriamento: 'Aliados pararam de responder ou caíram.',
  visita_adversario: 'Visita ou agenda dele no município.',
  proposta_broker: 'Liderança ou intermediário pediu ou ofereceu algo.',
  outro: 'Fato importante que não encaixa acima.',
}

export const parseMunicipalitySignalType = (
  raw: string | undefined,
): MunicipalitySignalType | undefined => {
  if (!raw) return undefined
  return municipalitySignalTypes.includes(raw as MunicipalitySignalType)
    ? (raw as MunicipalitySignalType)
    : undefined
}

const optionalCount = z.number().int().min(0).max(MAX_VOTE_COUNT).optional()

export const municipalityUpdateCreateSchema = z
  .object({
    municipality: positiveRelationshipId,
    kind: z.enum(municipalityUpdateKinds).default('semanal'),
    worked: trimmedOptionalText(3000),
    failed: trimmedOptionalText(3000),
    needs: trimmedOptionalText(3000),
    body: trimmedOptionalText(5000),
    activeVolunteers: optionalCount,
    newSupports: optionalCount,
    signalType: z.enum(municipalitySignalTypes).optional(),
    /**
     * OH10 CAS opt-in on the parent municipality's `updatedAt` (feed order).
     * Absent → last-write-wins create.
     */
    baseUpdatedAt: optionalBaseUpdatedAtSchema,
  })
  .superRefine((data, context) => {
    if (data.kind === 'semanal') {
      if (!data.worked) {
        context.addIssue({ code: 'custom', message: 'Informe o que funcionou.', path: ['worked'] })
      }
      if (!data.failed) {
        context.addIssue({
          code: 'custom',
          message: 'Informe o que não funcionou.',
          path: ['failed'],
        })
      }
      if (!data.needs) {
        context.addIssue({
          code: 'custom',
          message: 'Informe o que você precisa.',
          path: ['needs'],
        })
      }
    } else if (!data.body) {
      context.addIssue({
        code: 'custom',
        message: 'Informe o texto da atualização.',
        path: ['body'],
      })
    }
    if (data.kind === 'sinal') {
      if (!data.signalType) {
        context.addIssue({
          code: 'custom',
          message: 'Informe o tipo do sinal.',
          path: ['signalType'],
        })
      }
    }
  })

export const MUNICIPALITY_UPDATE_CREATE_SAFE_MESSAGES = [OPS_UPDATED_AT_CONFLICT_MESSAGE] as const

export type MunicipalityUpdateCreateInput = z.input<typeof municipalityUpdateCreateSchema>
