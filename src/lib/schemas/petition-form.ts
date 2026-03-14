import { z } from 'zod'
import { contactSchema } from './contact'
import { commentSchema } from './comment'

export const petitionFormSchema = contactSchema.extend(commentSchema.shape)

export type PetitionFormInput = z.infer<typeof petitionFormSchema>
