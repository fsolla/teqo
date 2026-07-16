import { z } from 'zod'

export const campaignLoginSchema = z.object({
  email: z.email('Email inválido'),
  password: z.string().min(1, 'Informe a senha'),
})

export type CampaignLoginInput = z.infer<typeof campaignLoginSchema>
