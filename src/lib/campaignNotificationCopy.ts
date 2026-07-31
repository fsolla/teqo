import { CAMPAIGN_PUSH_CONSENT_MISSING_MESSAGE } from '@/lib/campaignConsentKeys'

export const CAMPAIGN_PUSH_CONSENT_REQUIRED_MESSAGE =
  'É necessário aceitar o consentimento para receber avisos push.'

export const CAMPAIGN_PUSH_SUBSCRIPTION_INVALID_MESSAGE = 'Dados de inscrição push inválidos.'

export const CAMPAIGN_NOTIFICATION_MARK_ALL_READ_ERROR_MESSAGE =
  'Não foi possível marcar as notificações como lidas.'

export const CAMPAIGN_PUSH_SUBSCRIBE_ERROR_MESSAGE = 'Não foi possível ativar os avisos push.'

export const CAMPAIGN_PUSH_UNSUBSCRIBE_ERROR_MESSAGE = 'Não foi possível desativar os avisos push.'

export const CAMPAIGN_NOTIFICATION_THROW_SAFE_MESSAGES = [
  CAMPAIGN_PUSH_CONSENT_MISSING_MESSAGE,
  CAMPAIGN_PUSH_CONSENT_REQUIRED_MESSAGE,
  CAMPAIGN_PUSH_SUBSCRIPTION_INVALID_MESSAGE,
] as const
