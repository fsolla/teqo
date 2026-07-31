import 'server-only'

import type { Payload } from 'payload'

import { relationshipId, requireRelationshipId } from '@/lib/relationship'
import {
  campaignInviteAutofillSchema,
  campaignInviteLoginSchema,
  type CampaignInviteAutofillInput,
  type CampaignInviteLoginInput,
} from '@/lib/schemas/invite'
import type { CampaignUser } from '@/payload-types'
import { requireLeadershipConsent, resolveInviteConsent } from '@/utilities/campaignConsent'
import {
  acquireCampaignInviteAccountLocks,
  acquireCampaignInviteRedemptionContactLock,
  consumeCampaignInvite,
  findSameContactAccountIDs,
  INVALID_CAMPAIGN_INVITE_MESSAGE,
  requireCampaignInvitePostgres,
} from '@/utilities/campaignInviteRepository'
import {
  assertContactPhoneAvailable,
  contactPhoneLockKeys,
} from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

const MISSING_CONSENT_MESSAGE = 'Consentimento ainda não configurado.'

type ProfileInput = {
  name: string
  phone: string
  email?: string | null
  gender?: 'feminino' | 'masculino' | 'outro' | 'nao_informado' | null
}

const profileContactData = (data: ProfileInput) => ({
  name: data.name,
  phone: data.phone,
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
  await acquireCampaignInviteRedemptionContactLock(payload, req, contactID)

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
          [originalContact.phone, data.phone].filter((phone): phone is string => Boolean(phone)),
        ),
      )
      await assertContactPhoneAvailable(
        payload,
        req,
        data.phone,
        contactID,
        INVALID_CAMPAIGN_INVITE_MESSAGE,
      )
      await payload.update({
        collection: 'contact',
        id: contactID,
        data: profileContactData(data),
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
          [originalContact.phone, data.phone].filter((phone): phone is string => Boolean(phone)),
        ),
        ...(account?.username ? [`account-username:${account.username}`] : []),
        `account-username:${data.phone}`,
        ...(account ? [`invite-redemption-user:${account.id}`] : []),
      ])
      await assertContactPhoneAvailable(
        payload,
        req,
        data.phone,
        originalContact.id,
        INVALID_CAMPAIGN_INVITE_MESSAGE,
      )
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
        data: profileContactData(data),
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
