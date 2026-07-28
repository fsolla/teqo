/**
 * Client-safe contract for the biometric login (WebAuthn) ceremonies shared by
 * the browser islands and the `/campanha/webauthn/*` route handlers. Values
 * only — the relying-party resolution and every verification live in
 * `server-only` modules.
 */

/**
 * Ceiling on passkeys per account. High enough for phone + tablet + laptop,
 * low enough that a stolen session cannot seed an unbounded set of silent
 * back doors into the account.
 */
export const CAMPAIGN_WEBAUTHN_MAX_CREDENTIALS = 5

/** Cap on the device label so the profile list cannot be used as free storage. */
export const CAMPAIGN_WEBAUTHN_DEVICE_LABEL_MAX_LENGTH = 60

export const CAMPAIGN_WEBAUTHN_ROUTES = {
  loginOptions: '/campanha/webauthn/login-options',
  login: '/campanha/webauthn/login',
  registerOptions: '/campanha/webauthn/register-options',
  register: '/campanha/webauthn/register',
} as const

/** A passkey as the profile list renders it. */
export type CampaignPasskeyView = {
  id: number
  deviceLabel: string
  createdAt: string
  lastUsedAt: string | null
}

type CampaignWebAuthnErrorResponse = {
  status: 'error'
  message: string
}

export type CampaignWebAuthnOptionsResponse<Options> =
  | { status: 'success'; options: Options }
  | CampaignWebAuthnErrorResponse

export type CampaignWebAuthnRegisterResponse =
  | { status: 'success'; message: string; passkey: CampaignPasskeyView }
  | CampaignWebAuthnErrorResponse

export type CampaignWebAuthnLoginResponse =
  | { status: 'success'; redirectTo: string }
  | CampaignWebAuthnErrorResponse
