/**
 * Stable LGPD consent keys the app resolves at runtime (fail-closed: the flows
 * refuse to run while the admin has not created the Consent row with the exact
 * key). Client-safe constants — the resolution logic lives in
 * `src/utilities/campaignConsent.ts` (server-only).
 */
export const CAMPAIGN_INVITE_CONSENT_KEY = 'lideranca-autopreenchimento'

export const SUPPORTER_REGISTRATION_CONSENT_KEY = 'apoiador-cadastro'
export const SUPPORTER_VOTE_INTENTION_CONSENT_KEY = 'apoiador-intencao-voto'
