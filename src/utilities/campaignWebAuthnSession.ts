import 'server-only'

import {
  checkLoginPermission,
  createLocalReq,
  getFieldsToSign,
  jwtSign,
  type DataFromCollectionSlug,
  type Payload,
  type PayloadRequest,
} from 'payload'
import { addSessionToUser } from 'payload/shared'

import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

export const CAMPAIGN_WEBAUTHN_ACCOUNT_UNAVAILABLE_MESSAGE =
  'Não foi possível entrar com este aparelho. Use sua senha.'

export const CAMPAIGN_WEBAUTHN_ACCOUNT_LOCKED_MESSAGE =
  'Sua conta está bloqueada por tentativas de senha. Aguarde alguns minutos e tente de novo.'

/** The raw `campaign_user` row, as the database returns it. */
type CampaignUserRow = DataFromCollectionSlug<'campaignUser'>

/**
 * Mints a `campaignUser` session for a passkey the server already verified.
 * Payload 3.82 has no password-less login path (`loginOperation` requires one),
 * so this reproduces what that operation does after the password check
 * succeeds, using only public exports: lockout check → session row → signed JWT.
 *
 * Two details are load-bearing:
 *
 * 1. **The user is loaded with `payload.db.findOne`, never `payload.findByID`**
 *    — the raw row, which is what `loginOperation` reads. The Local API hides
 *    `lockUntil` and `loginAttempts` from an auth read, so with `findByID` the
 *    `checkLoginPermission` below would see an unlocked account every time and
 *    a passkey would become the way AROUND the password lockout. Measured on
 *    3.82.0, and pinned by the "refuses a locked account" int test.
 *    (Two dangers the plan predicted are not reproducible here and should not
 *    be re-derived: `sessions` survives the read — `removePrivateAuthFields`
 *    returns early when there is no `req.user` — and the absent `hash`/`salt`
 *    are skipped rather than nulled by the write, so a password still works.
 *    The lockout hole is the real one.)
 * 2. **The whole thing runs under an advisory lock**, because
 *    `addSessionToUser` writes the WHOLE document back, `sessions` array
 *    included: two devices signing in at the same instant would each persist an
 *    array that never saw the other's row.
 */
export const issueCampaignWebAuthnSession = async (
  payload: Payload,
  userID: number,
): Promise<{ token: string; tokenExpiration: number }> => {
  const collection = payload.collections.campaignUser
  if (!collection) throw new Error('A collection campaignUser não está disponível.')
  const collectionConfig = collection.config

  return withPayloadTransaction(payload, async ({ transactionID }) => {
    await acquireTextAdvisoryLocks(payload, { transactionID }, [
      `campaign-webauthn-session:${userID}`,
    ])

    // `checkLoginPermission` needs `req.t`, and `addSessionToUser` needs a real
    // request to keep its write inside this transaction.
    const req: PayloadRequest = await createLocalReq({ req: { transactionID } }, payload)

    const user = await payload.db.findOne<CampaignUserRow>({
      collection: 'campaignUser',
      req,
      where: { id: { equals: userID } },
    })
    if (!user) throw new Error(CAMPAIGN_WEBAUTHN_ACCOUNT_UNAVAILABLE_MESSAGE)

    // A passkey must not be the way around a lockout. With the account already
    // proven to exist, the only thing this can throw is `LockedAuth`, whose
    // message is Payload's generic i18n string — so it is restated in the terms
    // the login screen uses.
    try {
      checkLoginPermission<'campaignUser'>({ req, user })
    } catch {
      throw new Error(CAMPAIGN_WEBAUTHN_ACCOUNT_LOCKED_MESSAGE)
    }

    // Same shape `loginOperation` hands it; `addSessionToUser` stamps
    // `collection`/`_strategy` itself once the row is written.
    const { sid } = await addSessionToUser({ collectionConfig, payload, req, user })

    const fieldsToSign = getFieldsToSign({
      collectionConfig,
      // A leadership account signs in by phone and has no e-mail; the claim is
      // decorative anyway, since `payload.auth` re-reads the row.
      email: user.email ?? '',
      sid,
      user,
    })

    const tokenExpiration = collectionConfig.auth.tokenExpiration
    const { token } = await jwtSign({
      fieldsToSign,
      secret: payload.secret,
      tokenExpiration,
    })

    return { token, tokenExpiration }
  })
}
