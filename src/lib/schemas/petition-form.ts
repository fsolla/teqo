import { z } from 'zod'
import { commentSchema } from './comment'
import { contactSchema } from './contact'

export const petitionFormSchema = contactSchema.extend(commentSchema.shape)

export type PetitionFormInput = z.infer<typeof petitionFormSchema>
