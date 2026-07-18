import { z } from 'zod'

import { positiveRelationshipId, trimmedOptionalText } from '@/lib/schemas/primitives'

export const nucleusUpdateCreateSchema = z
  .object({
    nucleus: positiveRelationshipId,
    kind: z.enum(['semanal', 'urgente', 'nota']).default('semanal'),
    worked: trimmedOptionalText(3000),
    failed: trimmedOptionalText(3000),
    needs: trimmedOptionalText(3000),
    activeVolunteers: z.number().int().nonnegative().max(100_000_000).optional(),
    newSupports: z.number().int().nonnegative().max(100_000_000).optional(),
    body: trimmedOptionalText(5000),
  })
  .superRefine((data, context) => {
    if (data.kind === 'semanal') {
      for (const [field, value, message] of [
        ['worked', data.worked, 'Informe o que funcionou.'],
        ['failed', data.failed, 'Informe o que não funcionou.'],
        ['needs', data.needs, 'Informe o que você precisa.'],
      ] as const) {
        if (!value) {
          context.addIssue({
            code: 'custom',
            path: [field],
            message,
          })
        }
      }
      return
    }

    if (!data.body) {
      context.addIssue({
        code: 'custom',
        path: ['body'],
        message: 'Informe o texto da atualização.',
      })
    }
  })

export type NucleusUpdateCreateInput = z.input<typeof nucleusUpdateCreateSchema>
