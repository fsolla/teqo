import { CAMPAIGN_PUSH_CONSENT_MISSING_MESSAGE } from '@/lib/campaignConsentKeys'

export const CAMPAIGN_PUSH_CONSENT_REQUIRED_MESSAGE =
  'É necessário aceitar o consentimento para receber avisos push.'

export const CAMPAIGN_PUSH_SUBSCRIPTION_INVALID_MESSAGE = 'Dados de inscrição push inválidos.'

export const CAMPAIGN_NOTIFICATION_LOAD_ERROR_MESSAGE = 'Não foi possível carregar as notificações.'

export const CAMPAIGN_PUSH_SUBSCRIBE_ERROR_MESSAGE = 'Não foi possível ativar os avisos push.'

export const CAMPAIGN_PUSH_UNSUBSCRIBE_ERROR_MESSAGE = 'Não foi possível desativar os avisos push.'

export const CAMPAIGN_PUSH_CONSENT_UNCONFIGURED_MESSAGE =
  'Consentimento de push ainda não configurado no admin.'

export const CAMPAIGN_PUSH_ENV_MISSING_MESSAGE = 'Push ainda não está disponível neste ambiente.'

export const CAMPAIGN_PUSH_UNSUPPORTED_MESSAGE = 'Este navegador não suporta notificações push.'

export const CAMPAIGN_PUSH_PERMISSION_DENIED_MESSAGE =
  'Permissão bloqueada no navegador. Abra as configurações do site (cadeado na barra de endereço), permita notificações e tente novamente.'

export const CAMPAIGN_PUSH_PERMISSION_NOT_SHOWN_MESSAGE =
  'O navegador não exibiu o pedido de permissão. Tente ativar novamente.'

export const CAMPAIGN_PUSH_OPT_IN_TOAST_TITLE = 'Receba avisos da campanha'

export const CAMPAIGN_PUSH_OPT_IN_TOAST_DESCRIPTION =
  'Alertas de atualizações, novos apoiadores e agenda, mesmo com o app fechado. Ao ativar, você concorda com o aviso LGPD de notificações.'

export const CAMPAIGN_PUSH_OPT_IN_ACCEPT_LABEL = 'Aceitar e ativar'

export const CAMPAIGN_PUSH_ACTIVATED_MESSAGE = 'Avisos push ativados neste dispositivo.'

export const CAMPAIGN_NOTIFICATION_THROW_SAFE_MESSAGES = [
  CAMPAIGN_PUSH_CONSENT_MISSING_MESSAGE,
  CAMPAIGN_PUSH_CONSENT_REQUIRED_MESSAGE,
  CAMPAIGN_PUSH_SUBSCRIPTION_INVALID_MESSAGE,
] as const
