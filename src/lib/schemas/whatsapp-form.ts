import { z } from 'zod'
import { contactSchema } from './contact'
import { commentSchema } from './comment'

export const whatsAppFormSchema = contactSchema
  .omit({ postalCode: true })
  .extend(commentSchema.shape)

export type WhatsAppFormInput = z.infer<typeof whatsAppFormSchema>
