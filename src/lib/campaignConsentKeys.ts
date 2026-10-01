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

export const CAMPAIGN_PUSH_CONSENT_KEY = 'campanha-notificacoes-push'
export const CAMPAIGN_PUSH_CONSENT_MISSING_MESSAGE =
  'Consentimento de notificações push ainda não configurado.'

/**
 * C242 — the public selfie search on the photo album (scope B: the anonymous
 * descriptor index of the approved archive). Two keys because the two
 * biometric documents are distinct: `FACE_SEARCH_CONSENT_KEY` is the visitor's
 * consent for the temporary use of their own face in this query (the vector is
 * discarded with the request), while `FACE_INDEX_CONSENT_KEY` is the PUBLIC
 * NOTICE of the anonymous archive index (transparency + self-service opt-out;
 * there is no per-person enrollment). Both fail closed: without the Consent row
 * with the exact key the flow is closed, and the texts are versioned in
 * `scripts/lib/faceConsentTexts.mjs` (provisioned by `pnpm seed:face-consents`).
 */
export const FACE_SEARCH_CONSENT_KEY = 'busca-selfie-fotos'
export const FACE_INDEX_CONSENT_KEY = 'busca-selfie-indice'

/**
 * S9 — campaign home "novidades" capture (name + WhatsApp, engagement level
 * toggle). Fail-closed like every public flow: while the admin has not created
 * the Consent row with this key (jurídico-approved text pending), the form
 * refuses to record anything.
 */
export const CAMPAIGN_NEWSLETTER_CONSENT_KEY = 'campanha-novidades'
export const CAMPAIGN_NEWSLETTER_CONSENT_MISSING_MESSAGE =
  'Consentimento de novidades da campanha ainda não configurado.'
