// ---------------------------------------------------------------------------
// Biometric login credentials (WebAuthn passkeys)
// ---------------------------------------------------------------------------

import { isCampaignUser, isPayloadAdmin, payloadAdminOnly } from '@/utilities/access/shared'
import type { Access } from 'payload'

/**
 * A passkey is a login factor, so it is strictly the owner's business: nobody
 * on staff — coordinator included — reads or revokes another account's
 * credentials. The row-level constraint (not a boolean) is what keeps a
 * campaign JWT hitting `/api/campaignWebAuthnCredential` scoped to itself.
 */
export const canReadOwnWebAuthnCredentials: Access = ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  if (!isCampaignUser(req.user)) return false

  return { user: { equals: req.user.id } }
}

export const canDeleteOwnWebAuthnCredentials: Access = canReadOwnWebAuthnCredentials

/**
 * Enrollment and the sign-counter/`lastUsedAt` bump both run inside the
 * ceremony's transaction with `overrideAccess: true`, after the server verified
 * the attestation. Nothing else may write a credential: a client-shaped create
 * would let a session register a public key the authenticator never signed.
 */
export const canWriteWebAuthnCredentials: Access = payloadAdminOnly
