import { z } from 'zod'
import { commentSchema } from './comment'
import { contactSchema } from './contact'

export const whatsAppFormSchema = contactSchema
  .omit({ postalCode: true })
  .extend(commentSchema.shape)

export type WhatsAppFormInput = z.infer<typeof whatsAppFormSchema>
