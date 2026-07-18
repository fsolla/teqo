import { normalizeBrazilianPhone } from '@/utilities/phone'
import { z } from 'zod'

const campaignIdentifierSchema = z
  .string()
  .trim()
  .min(1, 'Informe o e-mail ou celular')
  .transform((value, context) => {
    const phone = normalizeBrazilianPhone(value)

    if (phone) return phone
    if (z.email().safeParse(value).success) return value

    context.addIssue({
      code: 'custom',
      message: 'Informe um e-mail ou celular válido',
    })

    return z.NEVER
  })

export const campaignLoginSchema = z.object({
  identifier: campaignIdentifierSchema,
  password: z.string().min(1, 'Informe a senha'),
})

export type CampaignLoginInput = z.infer<typeof campaignLoginSchema>
