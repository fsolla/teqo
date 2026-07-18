import { createHash, randomBytes } from 'node:crypto'

import { buildWhatsAppUrl } from '@/utilities/phone'

export const CAMPAIGN_INVITE_CONSENT_KEY = 'lideranca-autopreenchimento'
export const CAMPAIGN_INVITE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000

export type CampaignInviteKind = 'login' | 'autopreenchimento'

export const hashCampaignInviteToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex')

export const generateCampaignInviteToken = (): {
  token: string
  tokenHash: string
} => {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashCampaignInviteToken(token),
  }
}

export const campaignInviteExpiry = (now = new Date()): Date =>
  new Date(now.getTime() + CAMPAIGN_INVITE_EXPIRATION_MS)

type WhatsAppInviteInput = {
  phone: string
  recipientName: string
  senderName: string
  inviteUrl: string
  kind: CampaignInviteKind
}

export const buildCampaignInviteWhatsAppLink = ({
  phone,
  recipientName,
  senderName,
  inviteUrl,
  kind,
}: WhatsAppInviteInput): string => {
  const action =
    kind === 'login'
      ? 'Crie ou recupere seu acesso à plataforma'
      : 'Complete e confirme seu cadastro'
  const message = `Oi ${recipientName}, aqui é ${senderName} da campanha do Solla. ${action} neste link: ${inviteUrl}`

  return buildWhatsAppUrl(phone, message)
}
