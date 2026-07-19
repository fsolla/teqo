import 'server-only'

import { getCampaignInviteBaseURL } from '@/utilities/campaignInviteOrigin'

export const CAMPAIGN_PASSWORD_RESET_GENERIC_MESSAGE =
  'Se existir uma conta com este e-mail, você receberá um link para redefinir a senha em instantes.'

export const CAMPAIGN_PASSWORD_RESET_INVALID_TOKEN_MESSAGE =
  'Este link de redefinição é inválido ou expirou. Solicite um novo e-mail ou peça um convite ao coordenador.'

export const CAMPAIGN_LEADERSHIP_FORGOT_PASSWORD_MESSAGE =
  'Se você acessa com celular, peça um novo convite de acesso ao seu coordenador. A recuperação por e-mail só funciona para contas com e-mail cadastrado.'

export const buildCampaignPasswordResetUrl = (token: string): string => {
  const baseURL = getCampaignInviteBaseURL()
  return `${baseURL}/campanha/redefinir-senha?token=${encodeURIComponent(token)}`
}

export const isCampaignEmailConfigured = (): boolean => {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromAddress = process.env.CAMPAIGN_EMAIL_FROM?.trim()

  return Boolean(apiKey && fromAddress)
}

export const assertCampaignEmailConfigured = (): void => {
  if (process.env.NODE_ENV !== 'production') return
  if (isCampaignEmailConfigured()) return

  throw new Error('Campaign password reset email is not configured in production.')
}
