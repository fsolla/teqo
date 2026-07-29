import 'server-only'

import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { APIError, type Payload } from 'payload'
import { cache } from 'react'

import { CAMPAIGN_BIOMETRIC_DUPLICATE_DEVICE_MESSAGE } from '@/lib/campaignAuthCopy'
import { CAMPAIGN_WEBAUTHN_MAX_CREDENTIALS, type CampaignPasskeyView } from '@/lib/campaignWebAuthn'
import { requireRelationshipId } from '@/lib/relationship'
import type { CampaignUser, CampaignWebAuthnCredential } from '@/payload-types'
import {
  clearCampaignWebAuthnChallenge,
  readCampaignWebAuthnChallenge,
  storeCampaignWebAuthnChallenge,
} from '@/utilities/webauthn/campaignWebAuthnChallenge'
import { resolveCampaignWebAuthnRelyingParty } from '@/utilities/webauthn/campaignWebAuthnConfig'
import { issueCampaignWebAuthnSession } from '@/utilities/webauthn/campaignWebAuthnSession'

const COLLECTION = 'campaignWebAuthnCredential'
// Intentional admin bypass in this module's reads/writes: credential access is
// owner-scoped at the collection, but the ceremony runs BEFORE a session exists
// (login) and the counter/lastUsedAt writes are machine state the user must not
// write — every call here follows a cryptographic verification that IS the
// authorization check.

/**
 * Refusals a route may repeat verbatim (`campaignWebAuthnSafeMessages`), which is
 * why they are module-local: the array IS the export, and letting a caller reach
 * for one of them individually is how a message ends up shown without being on
 * the allowlist that makes it safe.
 */
const CAMPAIGN_WEBAUTHN_UNAVAILABLE_MESSAGE =
  'A entrada por biometria não está disponível neste endereço.'
const CAMPAIGN_WEBAUTHN_REJECTED_MESSAGE =
  'Não foi possível confirmar a biometria. Tente novamente ou use sua senha.'
const CAMPAIGN_WEBAUTHN_UNKNOWN_DEVICE_MESSAGE =
  'Este aparelho não está mais autorizado. Entre com sua senha e cadastre-o novamente.'
const CAMPAIGN_WEBAUTHN_LIMIT_MESSAGE = `Você já cadastrou ${CAMPAIGN_WEBAUTHN_MAX_CREDENTIALS} aparelhos. Remova um antes de cadastrar outro.`

export const CAMPAIGN_PASSKEY_REMOVE_DENIED_MESSAGE =
  'Este aparelho não pertence à sua conta ou já foi removido.'

export const campaignWebAuthnSafeMessages = [
  CAMPAIGN_WEBAUTHN_UNAVAILABLE_MESSAGE,
  CAMPAIGN_WEBAUTHN_REJECTED_MESSAGE,
  CAMPAIGN_WEBAUTHN_UNKNOWN_DEVICE_MESSAGE,
  CAMPAIGN_WEBAUTHN_LIMIT_MESSAGE,
  CAMPAIGN_BIOMETRIC_DUPLICATE_DEVICE_MESSAGE,
] as const

const requireRelyingParty = async () => {
  const relyingParty = await resolveCampaignWebAuthnRelyingParty()
  if (!relyingParty) throw new Error(CAMPAIGN_WEBAUTHN_UNAVAILABLE_MESSAGE)
  return relyingParty
}

const readTransports = (value: unknown): AuthenticatorTransportFuture[] | undefined =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? (value as AuthenticatorTransportFuture[])
    : undefined

const toCampaignPasskeyView = (credential: CampaignWebAuthnCredential): CampaignPasskeyView => ({
  id: credential.id,
  deviceLabel: credential.deviceLabel,
  createdAt: credential.createdAt,
  lastUsedAt: credential.lastUsedAt ?? null,
})

const findCredentialsOfUser = async (
  payload: Payload,
  userID: number,
): Promise<CampaignWebAuthnCredential[]> => {
  const result = await payload.find({
    collection: COLLECTION,
    where: { user: { equals: userID } },
    depth: 0,
    limit: CAMPAIGN_WEBAUTHN_MAX_CREDENTIALS + 1,
    pagination: false,
    sort: '-createdAt',
    overrideAccess: true,
  })
  return result.docs
}

/**
 * The account's enrolled devices. React `cache()` because two consumers ask in
 * the same request on `/campanha/perfil` — the shell layout, which only needs
 * to know whether the list is empty, and the profile card, which renders it.
 * Per-request only: a session's own passkeys must never be cached across
 * requests.
 */
export const loadCampaignPasskeys = cache(
  async (payload: Payload, userID: number): Promise<CampaignPasskeyView[]> =>
    (await findCredentialsOfUser(payload, userID)).map(toCampaignPasskeyView),
)

export const buildCampaignRegistrationOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<PublicKeyCredentialCreationOptionsJSON> => {
  const relyingParty = await requireRelyingParty()

  const existing = await findCredentialsOfUser(payload, user.id)
  if (existing.length >= CAMPAIGN_WEBAUTHN_MAX_CREDENTIALS) {
    throw new Error(CAMPAIGN_WEBAUTHN_LIMIT_MESSAGE)
  }

  const options = await generateRegistrationOptions({
    rpID: relyingParty.rpID,
    rpName: relyingParty.rpName,
    // Identifier the OS shows in its passkey manager. A leadership account has
    // no e-mail, so the phone (or the name) is what makes the entry legible.
    userName: user.email ?? user.username ?? user.name,
    userDisplayName: user.name,
    attestationType: 'none',
    // Already enrolled devices are excluded so the OS says "already registered"
    // instead of silently creating a second credential for the same phone.
    excludeCredentials: existing.map((credential) => ({
      id: credential.credentialId,
      transports: readTransports(credential.transports),
    })),
    authenticatorSelection: {
      // Discoverable + platform is what lets the login screen offer biometrics
      // before the user types any identifier.
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
  })

  // Signed AFTER generation, so the cookie holds exactly the base64url the
  // browser will echo back (see `storeCampaignWebAuthnChallenge`), and bound to
  // this account so an enrollment challenge cannot be spent by another.
  await storeCampaignWebAuthnChallenge('registration', options.challenge, String(user.id))

  return options
}

export const completeCampaignRegistration = async (
  payload: Payload,
  user: CampaignUser,
  { credential, deviceLabel }: { credential: RegistrationResponseJSON; deviceLabel: string },
): Promise<CampaignPasskeyView> => {
  const relyingParty = await requireRelyingParty()
  const expectedChallenge = await readCampaignWebAuthnChallenge('registration', String(user.id))

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: relyingParty.origin,
      expectedRPID: relyingParty.rpID,
      requireUserVerification: true,
    })
  } finally {
    // Single-use whatever the verdict: a challenge that survived a failed
    // attempt is a challenge an attacker gets to retry.
    await clearCampaignWebAuthnChallenge('registration')
  }

  if (!verification.verified) throw new Error(CAMPAIGN_WEBAUTHN_REJECTED_MESSAGE)

  const { credential: verified } = verification.registrationInfo
  const existing = await findCredentialsOfUser(payload, user.id)
  if (existing.length >= CAMPAIGN_WEBAUTHN_MAX_CREDENTIALS) {
    throw new Error(CAMPAIGN_WEBAUTHN_LIMIT_MESSAGE)
  }
  if (existing.some((entry) => entry.credentialId === verified.id)) {
    throw new Error(CAMPAIGN_BIOMETRIC_DUPLICATE_DEVICE_MESSAGE)
  }

  const created = await payload.create({
    collection: COLLECTION,
    data: {
      user: user.id,
      credentialId: verified.id,
      publicKey: Buffer.from(verified.publicKey).toString('base64url'),
      counter: verified.counter,
      transports: credential.response.transports ?? null,
      deviceLabel,
    },
    depth: 0,
    overrideAccess: true,
  })

  return toCampaignPasskeyView(created)
}

export const buildCampaignAuthenticationOptions =
  async (): Promise<PublicKeyCredentialRequestOptionsJSON> => {
    const relyingParty = await requireRelyingParty()

    const options = await generateAuthenticationOptions({
      rpID: relyingParty.rpID,
      // No `allowCredentials`: the credential is discoverable, so the browser
      // asks the user which account to use and we never have to be told an
      // identifier before authenticating — which also means the login screen
      // leaks no "this phone belongs to somebody" signal.
      userVerification: 'required',
    })

    // No subject: nobody has identified themselves yet, which is the point.
    await storeCampaignWebAuthnChallenge('authentication', options.challenge)

    return options
  }

/**
 * Verifies an assertion and, on success, mints the campaign session. Returns
 * the token so the route can set the cookie (only a route/action may).
 */
export const completeCampaignAuthentication = async (
  payload: Payload,
  credential: AuthenticationResponseJSON,
): Promise<{ token: string; tokenExpiration: number }> => {
  const relyingParty = await requireRelyingParty()
  const expectedChallenge = await readCampaignWebAuthnChallenge('authentication')

  const stored = await payload.find({
    collection: COLLECTION,
    where: { credentialId: { equals: credential.id } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  const record = stored.docs[0]
  if (!record) {
    await clearCampaignWebAuthnChallenge('authentication')
    throw new Error(CAMPAIGN_WEBAUTHN_UNKNOWN_DEVICE_MESSAGE)
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: relyingParty.origin,
      expectedRPID: relyingParty.rpID,
      requireUserVerification: true,
      credential: {
        id: record.credentialId,
        publicKey: new Uint8Array(Buffer.from(record.publicKey, 'base64url')),
        counter: record.counter,
        transports: readTransports(record.transports),
      },
    })
  } finally {
    await clearCampaignWebAuthnChallenge('authentication')
  }

  if (!verification.verified) throw new Error(CAMPAIGN_WEBAUTHN_REJECTED_MESSAGE)

  const userID = requireRelationshipId(record.user, CAMPAIGN_WEBAUTHN_UNKNOWN_DEVICE_MESSAGE)

  const session = await issueCampaignWebAuthnSession(payload, userID)

  // Counter + freshness are recorded only after the session was minted: if the
  // mint refuses (locked account), the authenticator's counter must not have
  // moved on our side, or the next legitimate attempt would look like a replay.
  await payload.update({
    collection: COLLECTION,
    id: record.id,
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date().toISOString(),
    },
    depth: 0,
    overrideAccess: true,
  })

  return session
}

export const removeCampaignPasskey = async (
  payload: Payload,
  user: CampaignUser,
  passkeyID: number,
): Promise<void> => {
  try {
    await payload.delete({
      collection: COLLECTION,
      id: passkeyID,
      depth: 0,
      user,
      overrideAccess: false,
    })
  } catch (error) {
    // Payload answers somebody else's id with Forbidden and an already-deleted
    // one with NotFound; both become the same sentence, because distinguishing
    // them would confirm that another account owns that credential. Anything
    // else — a dropped connection, a failing hook — keeps bubbling: telling the
    // person "not yours" would send them away from something worth retrying.
    if (error instanceof APIError && (error.status === 403 || error.status === 404)) {
      throw new Error(CAMPAIGN_PASSKEY_REMOVE_DENIED_MESSAGE)
    }
    throw error
  }
}
