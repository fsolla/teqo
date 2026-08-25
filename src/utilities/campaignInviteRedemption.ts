import 'server-only'

import type { Payload } from 'payload'

import { primaryPhoneOf, reorderWithPrimaryPhone } from '@/lib/phone'
import { relationshipId, requireRelationshipId } from '@/lib/relationship'
import {
  campaignInviteAutofillSchema,
  campaignInviteLoginSchema,
  type CampaignInviteAutofillInput,
  type CampaignInviteLoginInput,
} from '@/lib/schemas/invite'
import type { CampaignUser, Contact } from '@/payload-types'
import { requireLeadershipConsent, resolveInviteConsent } from '@/utilities/campaignConsent'
import {
  acquireCampaignInviteAccountLocks,
  consumeCampaignInvite,
  findSameContactAccountIDs,
  INVALID_CAMPAIGN_INVITE_MESSAGE,
  requireCampaignInvitePostgres,
} from '@/utilities/campaignInviteRepository'
import { acquireContactFichaLock, contactPhoneLockKeys } from '@/utilities/contactPhoneLocks'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

const MISSING_CONSENT_MESSAGE = 'Consentimento ainda não configurado.'

type ProfileInput = {
  name: string
  phone: string
  email?: string | null
  gender?: 'feminino' | 'masculino' | 'outro' | 'nao_informado' | null
}

const profileContactData = (data: ProfileInput, originalPhones: Contact['phones']) => ({
  name: data.name,
  // The typed phone becomes the PRIMARY of the anchored ficha; every number
  // the ficha already had is kept (an earlier occurrence of the typed phone
  // moves, never duplicates) — the person's other numbers survive the invite.
  phones: reorderWithPrimaryPhone(originalPhones, data.phone).map((value) => ({ value })),
  ...(data.email !== undefined ? { email: data.email } : {}),
  ...(data.gender !== undefined ? { gender: data.gender } : {}),
})

const consentUpdateData = (
  resolution: ReturnType<typeof resolveInviteConsent>,
): {
  consent?: number
  consentContentHash?: string
  consentedAt?: string
} =>
  resolution.shouldUpdate
    ? {
        consent: resolution.consentID,
        consentContentHash: resolution.consentContentHash,
        consentedAt: resolution.consentedAt,
      }
    : {}

const findReusableLeadershipAccount = async (
  payload: Payload,
  req: PayloadTransactionRequest,
  leadership: { contact: unknown; user?: unknown },
): Promise<CampaignUser | null> => {
  const contactID = requireRelationshipId(leadership.contact)

  let accountID = relationshipId(leadership.user)
  if (accountID === null) {
    const linkedAccountIDs = await findSameContactAccountIDs(payload, req, contactID)
    if (linkedAccountIDs.length > 1) throw new Error(INVALID_CAMPAIGN_INVITE_MESSAGE)
    accountID = linkedAccountIDs[0] ?? null
  }
  if (accountID === null) return null
  return payload.findByID({
    collection: 'campaignUser',
    id: accountID,
    depth: 0,
    overrideAccess: true,
    req,
  })
}

export const redeemCampaignInviteAutofillRecord = async (
  payload: Payload,
  input: CampaignInviteAutofillInput,
): Promise<{ ok: true }> => {
  const data = campaignInviteAutofillSchema.parse(input)
  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      requireCampaignInvitePostgres(payload)
      const leadershipID = await consumeCampaignInvite(
        payload,
        req,
        data.token,
        'autopreenchimento',
      )
      // The consumed single-use token scopes this restricted self-service transaction.
      const [leadership, consent] = await Promise.all([
        payload.findByID({
          collection: 'leadership',
          id: leadershipID,
          depth: 0,
          overrideAccess: true,
          req,
        }),
        requireLeadershipConsent(payload, req, MISSING_CONSENT_MESSAGE),
      ])
      const consentResolution = resolveInviteConsent({
        existingConsentID: relationshipId(leadership.consent),
        existingConsentContentHash: leadership.consentContentHash,
        configuredConsentID: consent.id,
        configuredConsentContentHash: consent.contentHash,
        consentAccepted: data.consentAccepted,
      })
      const contactID = requireRelationshipId(leadership.contact)
      const originalContact = await payload.findByID({
        collection: 'contact',
        id: contactID,
        depth: 0,
        overrideAccess: true,
        req,
      })
      await acquireCampaignInviteAccountLocks(
        payload,
        req,
        contactPhoneLockKeys(
          [primaryPhoneOf(originalContact.phones), data.phone].filter((phone): phone is string =>
            Boolean(phone),
          ),
        ),
      )
      // C121 — serialize the contact RMW on the C120 ficha lock (`contact-ficha:<id>`),
      // acquired AFTER the phone/account locks to honor that order and avoid a deadlock.
      await acquireContactFichaLock(payload, req, contactID)
      // C121 (bypass) — re-read phones inside the ficha lock: the read above was
      // pre-lock, so a concurrent create-append would otherwise be dropped here.
      const currentPhones = (
        await payload.findByID({
          collection: 'contact',
          id: contactID,
          depth: 0,
          select: { phones: { value: true } },
          overrideAccess: true,
          req,
        })
      ).phones
      // C111 — the phone is a contact channel, not a unique person identity:
      // the ficha this invite anchors is known (leadership.contact), so the
      // typed number may legitimately match another ficha's.
      await payload.update({
        collection: 'contact',
        id: contactID,
        data: profileContactData(data, currentPhones),
        depth: 0,
        overrideAccess: true,
        req,
      })
      await payload.update({
        collection: 'leadership',
        id: leadership.id,
        data: consentUpdateData(consentResolution),
        depth: 0,
        overrideAccess: true,
        req,
      })
      return { ok: true }
    },
    { beginFailureMessage: 'Não foi possível iniciar a transação do convite.' },
  )
}

export const redeemCampaignInviteLoginRecord = async (
  payload: Payload,
  input: CampaignInviteLoginInput,
): Promise<{ token: string }> => {
  const data = campaignInviteLoginSchema.parse(input)
  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      requireCampaignInvitePostgres(payload)
      const leadershipID = await consumeCampaignInvite(payload, req, data.token, 'login')
      // The consumed single-use token scopes all trusted account and profile writes below.
      const leadership = await payload.findByID({
        collection: 'leadership',
        id: leadershipID,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (leadership.supportStatus !== 'engajado') {
        throw new Error(INVALID_CAMPAIGN_INVITE_MESSAGE)
      }
      const configuredConsent = await requireLeadershipConsent(
        payload,
        req,
        MISSING_CONSENT_MESSAGE,
      )
      const consentResolution = resolveInviteConsent({
        existingConsentID: relationshipId(leadership.consent),
        existingConsentContentHash: leadership.consentContentHash,
        configuredConsentID: configuredConsent.id,
        configuredConsentContentHash: configuredConsent.contentHash,
        consentAccepted: data.consentAccepted,
      })
      const originalContact = await payload.findByID({
        collection: 'contact',
        id: requireRelationshipId(leadership.contact),
        depth: 0,
        overrideAccess: true,
        req,
      })
      let account = await findReusableLeadershipAccount(payload, req, leadership)
      await acquireCampaignInviteAccountLocks(payload, req, [
        ...contactPhoneLockKeys(
          [primaryPhoneOf(originalContact.phones), data.phone].filter((phone): phone is string =>
            Boolean(phone),
          ),
        ),
        ...(account?.username ? [`account-username:${account.username}`] : []),
        `account-username:${data.phone}`,
        ...(account ? [`invite-redemption-user:${account.id}`] : []),
      ])
      // C121 — serialize the contact RMW on the C120 ficha lock (`contact-ficha:<id>`),
      // acquired AFTER the phone/account locks to honor that order and avoid a deadlock.
      await acquireContactFichaLock(payload, req, originalContact.id)
      // C121 (bypass) — re-read phones inside the ficha lock: the read above was
      // pre-lock, so a concurrent create-append would otherwise be dropped here.
      const currentPhones = (
        await payload.findByID({
          collection: 'contact',
          id: originalContact.id,
          depth: 0,
          select: { phones: { value: true } },
          overrideAccess: true,
          req,
        })
      ).phones
      // C111 — the ficha this invite anchors is known; the typed phone may be
      // shared with another ficha. The account side stays fail-closed below:
      // `username` is the login key and remains DB-unique, so the second
      // person with the same number uses e-mail (product recommendation A).
      const accounts = await payload.find({
        collection: 'campaignUser',
        where: { username: { equals: data.phone } },
        depth: 0,
        limit: 2,
        pagination: false,
        overrideAccess: true,
        req,
      })
      if (accounts.totalDocs > 1) {
        throw new Error('Existe mais de uma conta para este celular.')
      }
      const usernameOwner = accounts.docs[0]
      if (usernameOwner && usernameOwner.id !== account?.id) {
        throw new Error(INVALID_CAMPAIGN_INVITE_MESSAGE)
      }

      await payload.update({
        collection: 'contact',
        id: originalContact.id,
        data: profileContactData(data, currentPhones),
        depth: 0,
        overrideAccess: true,
        req,
      })
      const accountData = {
        name: data.name,
        phone: data.phone,
        username: data.phone,
        password: data.password,
        ...(data.email !== undefined ? { email: data.email } : {}),
        // C99 — the account points at the ficha that anchors the leadership:
        // one person, one ficha, even when the same person also holds a staff
        // account. Passed explicitly so the identity hook respects this choice
        // instead of syncing the account's phone into whatever ficha it had
        // (which would collide with the ficha this flow just updated).
        contact: originalContact.id,
      }
      const hadAccount = Boolean(account)
      account = account
        ? await payload.update({
            collection: 'campaignUser',
            id: account.id,
            data: accountData,
            depth: 0,
            overrideAccess: true,
            req,
          })
        : await payload.create({
            collection: 'campaignUser',
            data: { ...accountData, role: 'leader' },
            depth: 0,
            overrideAccess: true,
            req,
          })
      await payload.update({
        collection: 'leadership',
        id: leadership.id,
        data: {
          ...consentUpdateData(consentResolution),
          user: account.id,
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
      const updatedLeadership = await payload.findByID({
        collection: 'leadership',
        id: leadership.id,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (!hadAccount) {
        const { notifyInviteAccepted } = await import('@/utilities/notification/notificationEvents')
        await notifyInviteAccepted(
          { payload, context: {}, transactionID: req.transactionID },
          updatedLeadership,
        )
      }
      const login = await payload.login({
        collection: 'campaignUser',
        data: { username: data.phone, password: data.password },
        req,
      })
      if (!login.token) throw new Error('Não foi possível autenticar a conta criada.')
      return { token: login.token }
    },
    { beginFailureMessage: 'Não foi possível iniciar a transação do convite.' },
  )
}
