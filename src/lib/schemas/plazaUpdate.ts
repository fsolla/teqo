import { z } from 'zod'

import { positiveRelationshipId, trimmedOptionalText } from '@/lib/schemas/primitives'

export const plazaUpdateKinds = ['semanal', 'urgente', 'nota'] as const
export type PlazaUpdateKind = (typeof plazaUpdateKinds)[number]

export const plazaUpdateKindLabels: Record<PlazaUpdateKind, string> = {
  semanal: 'Semanal',
  urgente: 'Urgente',
  nota: 'Nota',
}

const optionalCount = z.number().int().min(0).max(1_000_000).optional()

export const plazaUpdateCreateSchema = z
  .object({
    plaza: positiveRelationshipId,
    kind: z.enum(plazaUpdateKinds).default('semanal'),
    worked: trimmedOptionalText(3000),
    failed: trimmedOptionalText(3000),
    needs: trimmedOptionalText(3000),
    body: trimmedOptionalText(5000),
    activeVolunteers: optionalCount,
    newSupports: optionalCount,
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
  })

export type PlazaUpdateCreateInput = z.input<typeof plazaUpdateCreateSchema>
