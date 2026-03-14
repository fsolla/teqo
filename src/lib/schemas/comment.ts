import { z } from 'zod'

export const commentSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(1000, 'Comentário muito longo')
    .refine((v) => !/<\/?[a-z][\s\S]*>/i.test(v), 'O comentário não pode conter HTML')
    .optional(),
})

export type Comment = z.infer<typeof commentSchema>
