/**
 * Stable LGPD consent keys the app resolves at runtime (fail-closed: the flows
 * refuse to run while the admin has not created the Consent row with the exact
 * key). Client-safe constants — the resolution logic lives in
 * `src/utilities/campaignConsent.ts` (server-only).
 */
export const CAMPAIGN_INVITE_CONSENT_KEY = 'lideranca-autopreenchimento'

export const SUPPORTER_REGISTRATION_CONSENT_KEY = 'apoiador-cadastro'
export const SUPPORTER_VOTE_INTENTION_CONSENT_KEY = 'apoiador-intencao-voto'

/**
 * Fail-closed refusals shown while the keyed Consent row is missing — matched
 * verbatim by the routes' `safeMessages`, so they live next to their keys.
 */
export const SUPPORTER_REGISTRATION_CONSENT_MISSING_MESSAGE =
  'Consentimento de cadastro de apoiador ainda não configurado.'
export const SUPPORTER_VOTE_INTENTION_CONSENT_MISSING_MESSAGE =
  'Consentimento de intenção de voto ainda não configurado.'

/**
 * Public-site WhatsApp subscription consent. Historically the flow hardcoded
 * `consent: 2`; migration `20260725_170000_whatsapp_subscription_consent_key`
 * tags that live document with this stable key (Pass 2 D3).
 */
export const WHATSAPP_SUBSCRIPTION_CONSENT_KEY = 'whatsapp-inscricao'
