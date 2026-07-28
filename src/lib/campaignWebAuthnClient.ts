/**
 * Browser half of the WebAuthn ceremonies (B40). Client-safe: it only speaks
 * `fetch` to the `/campanha/webauthn/*` routes and hands the JSON to
 * `@simplewebauthn/browser`. Both islands (login button, profile card) call
 * these, so the wire shape and the platform-error mapping exist once.
 *
 * Reached only through a dynamic `import()` from a handler — the library it
 * pulls in must not ride along in the First Load JS of routes that will never
 * run a ceremony. The probe and the error type live in `campaignWebAuthnSupport`
 * for exactly that reason.
 */

import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'

import {
  CAMPAIGN_BIOMETRIC_CANCELLED_MESSAGE,
  CAMPAIGN_BIOMETRIC_DUPLICATE_DEVICE_MESSAGE,
  CAMPAIGN_BIOMETRIC_UNSUPPORTED_MESSAGE,
} from '@/lib/campaignAuthCopy'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  CAMPAIGN_WEBAUTHN_ROUTES,
  type CampaignPasskeyView,
  type CampaignWebAuthnLoginResponse,
  type CampaignWebAuthnOptionsResponse,
  type CampaignWebAuthnRegisterResponse,
} from '@/lib/campaignWebAuthn'
import { CampaignWebAuthnError } from '@/lib/campaignWebAuthnSupport'

/**
 * Transport is `postCampaignJson`; this adds the two things the ceremonies need
 * on top of it. The status is dropped on purpose — a 403/409/500 from these
 * routes still carries the typed envelope, so the discriminant decides — and a
 * response that is not JSON at all (proxy error page, offline) surfaces as one
 * sentence instead of a `SyntaxError` about position 0. A rejection that is not
 * a parse failure is a network failure and is rethrown untouched.
 */
const postJson = async <Response>(path: string, body?: unknown): Promise<Response> => {
  try {
    const { payload } = await postCampaignJson<Response>(path, body ?? {})
    return payload
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Resposta inválida do servidor.')
    throw error
  }
}

/**
 * `navigator.credentials` rejects with DOM exceptions whose names are the only
 * reliable signal; the messages are browser-authored and untranslated. Hence an
 * unrecognized name returns a plain `Error`: the islands show their own copy for
 * anything that is not a `CampaignWebAuthnError`, and the original text stays in
 * the console instead of reaching a pt-BR screen in English.
 */
const asCeremonyError = (error: unknown): Error => {
  const name = error instanceof Error ? error.name : ''

  // NotAllowedError covers both "user closed the sheet" and "timed out", which
  // are the same thing from where the person is standing.
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return new CampaignWebAuthnError(CAMPAIGN_BIOMETRIC_CANCELLED_MESSAGE, { cancelled: true })
  }
  // InvalidStateError on create means this authenticator already holds a
  // credential we excluded — i.e. the device is enrolled already.
  if (name === 'InvalidStateError') {
    return new CampaignWebAuthnError(CAMPAIGN_BIOMETRIC_DUPLICATE_DEVICE_MESSAGE)
  }
  if (name === 'NotSupportedError' || name === 'SecurityError') {
    return new CampaignWebAuthnError(CAMPAIGN_BIOMETRIC_UNSUPPORTED_MESSAGE)
  }

  return error instanceof Error ? error : new Error('Falha desconhecida na cerimônia WebAuthn.')
}

const requireOptions = <Options>(payload: CampaignWebAuthnOptionsResponse<Options>): Options => {
  if (payload.status !== 'success') throw new CampaignWebAuthnError(payload.message)
  return payload.options
}

/** Enrolls this device. Returns the passkey so the list can render it at once. */
export const enrollCampaignPasskey = async (deviceLabel: string): Promise<CampaignPasskeyView> => {
  const options = requireOptions(
    await postJson<CampaignWebAuthnOptionsResponse<PublicKeyCredentialCreationOptionsJSON>>(
      CAMPAIGN_WEBAUTHN_ROUTES.registerOptions,
    ),
  )

  let credential
  try {
    credential = await startRegistration({ optionsJSON: options })
  } catch (error) {
    throw asCeremonyError(error)
  }

  const result = await postJson<CampaignWebAuthnRegisterResponse>(
    CAMPAIGN_WEBAUTHN_ROUTES.register,
    { credential, deviceLabel },
  )
  if (result.status !== 'success') throw new CampaignWebAuthnError(result.message)

  return result.passkey
}

/** Signs in. On success the `campaign-token` cookie is already set. */
export const signInWithCampaignPasskey = async (): Promise<string> => {
  const options = requireOptions(
    await postJson<CampaignWebAuthnOptionsResponse<PublicKeyCredentialRequestOptionsJSON>>(
      CAMPAIGN_WEBAUTHN_ROUTES.loginOptions,
    ),
  )

  let credential
  try {
    credential = await startAuthentication({ optionsJSON: options })
  } catch (error) {
    throw asCeremonyError(error)
  }

  const result = await postJson<CampaignWebAuthnLoginResponse>(CAMPAIGN_WEBAUTHN_ROUTES.login, {
    credential,
  })
  if (result.status !== 'success') throw new CampaignWebAuthnError(result.message)

  return result.redirectTo
}
