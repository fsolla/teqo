import type { RefinementCtx } from 'zod'
import { z } from 'zod'

export const CAMPAIGN_PASSWORD_RESET_TOKEN_MIN_LENGTH = 20

const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .max(128, 'A senha deve ter no máximo 128 caracteres.')

const refineMatchingPasswords = (
  data: { password: string; passwordConfirmation: string },
  context: RefinementCtx,
) => {
  if (data.password !== data.passwordConfirmation) {
    context.addIssue({
      code: 'custom',
      message: 'As senhas não coincidem.',
      path: ['passwordConfirmation'],
    })
  }
}

export const campaignPasswordResetRequestSchema = z.object({
  email: z.email('Informe um e-mail válido.').trim(),
})

export const campaignPasswordResetSchema = z
  .object({
    token: z.string().min(CAMPAIGN_PASSWORD_RESET_TOKEN_MIN_LENGTH).max(256),
    password: passwordSchema,
    passwordConfirmation: passwordSchema,
  })
  .superRefine(refineMatchingPasswords)

export const campaignChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    password: passwordSchema,
    passwordConfirmation: passwordSchema,
  })
  .superRefine((data, context) => {
    refineMatchingPasswords(data, context)
    if (data.currentPassword === data.password) {
      context.addIssue({
        code: 'custom',
        message: 'A nova senha deve ser diferente da atual.',
        path: ['password'],
      })
    }
  })
