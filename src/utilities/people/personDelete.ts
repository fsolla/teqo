import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import {
  PERSON_DELETE_FORBIDDEN_MESSAGE,
  PERSON_DELETE_PROTECTED_ACCOUNT_MESSAGE,
} from '@/lib/schemas/personDelete'
import type { CampaignUser, Contact, Leadership, StateDeputy } from '@/payload-types'
import { isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneInvariant'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import {
  acquireTextAdvisoryLocks,
  POSTGRES_DEDUP_LOCK_MESSAGE,
} from '@/utilities/postgresTransactionLocks'

/**
 * "Apagar pessoa" (C100): a destructive, transactional cascade from one
 * `Contact` ficha across every campaign role, preceded by a read-only manifest
 * the confirmation dialog lists verbatim. Coordinator/candidate accounts are
 * never deletable — a person holding one is a protected person.
 *
 * Every `overrideAccess` read/write below is an INTENTIONAL BYPASS justified
 * by this module's own authorization: the caller must be an unrestricted actor
 * (reloaded fresh by the server action) and the destructive path re-enumerates
 * every row it touches inside the transaction before deleting — the manifest
 * preview and the protected-account check are the scope proof, the same
 * documented pattern `removeSupporterData` established.
 *
 * The FK map this order respects (verified against the committed schema —
 * NOT NULL + `ON DELETE set null` = a delete that would block):
 *
 * - `vote_pledge.leadership_id`, `campaign_invite.leadership_id` → delete
 *   pledges and invites BEFORE the leadership rows;
 * - `campaign_invite.created_by_id`, `municipality_update.author_id`,
 *   `calendar_feed.created_by_id`, `supporter_import_batch.actor_id` → rows
 *   authored by the deleted accounts must go BEFORE the accounts;
 * - `campaign_web_authn_credential.user_id`, `notification.recipient_id`,
 *   `push_subscription.user_id` → cleaned by `campaignUser.beforeDelete`
 *   (passkeys + notifications), no hand-spelled copy here;
 * - every advisor join table (`municipality_rels`, `activity_rels`,
 *   `leadership_rels`, `state_deputy_rels`) cascades on `campaign_user_id`
 *   — deleting the accounts removes the carteira/assessorado links;
 * - `signature.contact_id`, `subscription.contact_id` → NOT NULL public-site
 *   joins: when either exists the ficha is ANONYMIZED (LGPD tombstone,
 *   `removeSupporterData` precedent), never deleted.
 */

type PersonDeletePayload = Pick<Payload, 'find' | 'findByID' | 'delete' | 'update' | 'db'>

export type PersonDeleteManifest = {
  contact: { id: number; name: string; phone: string | null; email: string | null }
  leaderships: Array<{ id: number; name: string; municipalityNames: string[] }>
  stateDeputies: Array<{ id: number; name: string; party: string | null }>
  pledgeCount: number
  inviteCount: number
  supporterCount: number
  municipalityUpdateCount: number
  calendarFeedCount: number
  accounts: Array<{ id: number; name: string; role: CampaignUser['role'] }>
  hasProtectedAccount: boolean
  /** signature/subscription still reference the ficha → it gets anonymized, not deleted. */
  fichaWillBeAnonymized: boolean
}

type DeleteEnumeration = {
  leadershipIDs: number[]
  accountIDs: number[]
  supporterCount: number
  signatureCount: number
  subscriptionCount: number
}

const enumeratePersonJoins = async (
  payload: PersonDeletePayload,
  contactID: number,
  req?: PayloadTransactionRequest,
): Promise<DeleteEnumeration> => {
  const [leaderships, accounts, supporters, signatures, subscriptions] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'campaignUser',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'supporter',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'signature',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'subscription',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
    }),
  ])

  return {
    leadershipIDs: leaderships.docs.map((doc) => doc.id),
    accountIDs: accounts.docs.map((doc) => doc.id),
    supporterCount: supporters.totalDocs,
    signatureCount: signatures.totalDocs,
    subscriptionCount: subscriptions.totalDocs,
  }
}

const anonymizeContact = async (
  payload: PersonDeletePayload,
  contactID: number,
  req: PayloadTransactionRequest,
): Promise<void> => {
  // Must match Contact phone validation: DDD + 9 + 8 digits (`^[1-9]{2}9\d{8}$`).
  // Same tombstone as `removeSupporterData` — one per id, so it is unique.
  const tombstonePhone = `999${String(contactID).padStart(8, '0')}`
  await acquireContactPhoneLocks(payload, req, [tombstonePhone])
  await payload.update({
    collection: 'contact',
    id: contactID,
    data: {
      name: 'Titular removido',
      email: null,
      phone: tombstonePhone,
      gender: null,
      city: null,
      postalCode: null,
    },
    depth: 0,
    overrideAccess: true,
    req,
  })
}

/**
 * Read-only enumeration for the confirmation dialog: every row the cascade
 * would touch, with the ficha fate spelled out. No writes, no locks.
 */
export const loadPersonDeleteManifest = async (
  payload: PersonDeletePayload,
  contactID: number,
): Promise<PersonDeleteManifest | null> => {
  let contact: Contact
  try {
    // Intentional admin bypass: the route gate already asserted an unrestricted
    // actor; `Contact` read is admin-gated and the manifest is exactly what
    // authorizes the destructive confirmation.
    contact = await payload.findByID({
      collection: 'contact',
      id: contactID,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return null
  }

  const [leaderships, stateDeputies, accounts] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: { contact: { equals: contactID } },
      depth: 1,
      limit: 0,
      pagination: false,
      select: { contact: true, municipalities: true },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'stateDeputy',
      where: { contact: { equals: contactID } },
      depth: 1,
      limit: 0,
      pagination: false,
      select: { contact: true, party: true },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'campaignUser',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { name: true, role: true },
      overrideAccess: true,
    }),
  ])

  const leadershipIDs = leaderships.docs.map((doc) => doc.id)
  const accountIDs = accounts.docs.map((doc) => doc.id)

  const [pledgeResult, inviteResult, municipalityUpdateResult, calendarFeedResult, joinCounts] =
    await Promise.all([
      payload.find({
        collection: 'votePledge',
        where: { leadership: { in: leadershipIDs } },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'campaignInvite',
        where: { leadership: { in: leadershipIDs } },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'municipalityUpdate',
        where: { author: { in: accountIDs } },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'calendarFeed',
        where: { createdBy: { in: accountIDs } },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
      }),
      enumeratePersonJoins(payload, contactID),
    ])

  const municipalityIDs = [
    ...new Set(
      (leaderships.docs as Leadership[]).flatMap((doc) =>
        (doc.municipalities ?? []).map(relationshipId).filter((id): id is number => id !== null),
      ),
    ),
  ]
  const municipalityNames = new Map<number, string>()
  if (municipalityIDs.length > 0) {
    const municipalities = await payload.find({
      collection: 'municipality',
      where: { id: { in: municipalityIDs } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { name: true },
      overrideAccess: true,
    })
    for (const municipality of municipalities.docs) {
      municipalityNames.set(municipality.id, municipality.name)
    }
  }

  const leadershipRows = (leaderships.docs as Leadership[]).map((doc) => ({
    id: doc.id,
    name: typeof doc.contact === 'object' && doc.contact !== null ? doc.contact.name : 'Contato',
    municipalityNames: (doc.municipalities ?? [])
      .map(relationshipId)
      .filter((id): id is number => id !== null)
      .map((id) => municipalityNames.get(id))
      .filter((name): name is string => name !== undefined),
  }))

  const deputyRows = (stateDeputies.docs as StateDeputy[]).map((doc) => ({
    id: doc.id,
    name: typeof doc.contact === 'object' && doc.contact !== null ? doc.contact.name : 'Contato',
    party: doc.party ?? null,
  }))

  return {
    contact: {
      id: contact.id,
      name: contact.name ?? 'Contato',
      phone: contact.phone ?? null,
      email: contact.email ?? null,
    },
    leaderships: leadershipRows,
    stateDeputies: deputyRows,
    pledgeCount: pledgeResult.totalDocs,
    inviteCount: inviteResult.totalDocs,
    supporterCount: joinCounts.supporterCount,
    municipalityUpdateCount: municipalityUpdateResult.totalDocs,
    calendarFeedCount: calendarFeedResult.totalDocs,
    accounts: accounts.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      role: doc.role,
    })),
    hasProtectedAccount: accounts.docs.some(
      (account) => account.role === 'coordinator' || account.role === 'candidate',
    ),
    fichaWillBeAnonymized: joinCounts.signatureCount > 0 || joinCounts.subscriptionCount > 0,
  }
}

export type PersonDeleteResult = {
  removed: true
  contactDeleted: boolean
  contactAnonymized: boolean
  deletedAccounts: number
}

/**
 * The destructive cascade, one transaction, one advisory lock per person.
 * Re-enumerates inside the transaction (the manifest is a preview, never the
 * authority) and aborts on a coordinator/candidate account.
 */
export const deletePersonRecord = async (
  payload: PersonDeletePayload,
  actor: CampaignUser,
  contactID: number,
): Promise<PersonDeleteResult> =>
  withPayloadTransaction(payload, async ({ req }) => {
    if (!isCampaignUnrestricted(actor)) {
      throw new Error(PERSON_DELETE_FORBIDDEN_MESSAGE)
    }
    if (payload.db.name !== 'postgres') {
      throw new Error(POSTGRES_DEDUP_LOCK_MESSAGE)
    }
    await acquireTextAdvisoryLocks(payload, req, [`person-delete:${contactID}`])

    const { leadershipIDs, accountIDs, supporterCount, signatureCount, subscriptionCount } =
      await enumeratePersonJoins(payload, contactID, req)

    if (accountIDs.length > 0) {
      const accounts = await payload.find({
        collection: 'campaignUser',
        where: { id: { in: accountIDs } },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { role: true },
        overrideAccess: true,
        req,
      })
      const protectedAccount = accounts.docs.find(
        (account) => account.role === 'coordinator' || account.role === 'candidate',
      )
      if (protectedAccount) {
        throw new Error(PERSON_DELETE_PROTECTED_ACCOUNT_MESSAGE)
      }
    }

    // Order matters — see the module contract. All bypasses are justified by
    // the enumeration + protected-account check above (removeSupporterData
    // precedent): the unrestricted actor's scope was proven before any write.
    if (leadershipIDs.length > 0) {
      await payload.delete({
        collection: 'votePledge',
        where: { leadership: { in: leadershipIDs } },
        depth: 0,
        overrideAccess: true,
        req,
      })
      await payload.delete({
        collection: 'campaignInvite',
        where: { leadership: { in: leadershipIDs } },
        depth: 0,
        overrideAccess: true,
        req,
      })
    }
    if (accountIDs.length > 0) {
      // Invites the deleted accounts CREATED for other leaderships, authored
      // municipality updates and calendar feeds all carry NOT NULL FKs with
      // `ON DELETE set null` — they must go before the accounts themselves.
      await payload.delete({
        collection: 'campaignInvite',
        where: { createdBy: { in: accountIDs } },
        depth: 0,
        overrideAccess: true,
        req,
      })
      await payload.delete({
        collection: 'municipalityUpdate',
        where: { author: { in: accountIDs } },
        depth: 0,
        overrideAccess: true,
        req,
      })
      await payload.delete({
        collection: 'calendarFeed',
        where: { createdBy: { in: accountIDs } },
        depth: 0,
        overrideAccess: true,
        req,
      })
      await payload.delete({
        collection: 'supporterImportBatch',
        where: { actor: { in: accountIDs } },
        depth: 0,
        overrideAccess: true,
        req,
      })
    }
    if (supporterCount > 0) {
      await payload.delete({
        collection: 'supporter',
        where: { contact: { equals: contactID } },
        depth: 0,
        overrideAccess: true,
        req,
      })
    }
    if (leadershipIDs.length > 0) {
      await payload.delete({
        collection: 'leadership',
        where: { contact: { equals: contactID } },
        depth: 0,
        overrideAccess: true,
        req,
      })
    }
    {
      const deputies = await payload.find({
        collection: 'stateDeputy',
        where: { contact: { equals: contactID } },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
        req,
      })
      if (deputies.docs.length > 0) {
        await payload.delete({
          collection: 'stateDeputy',
          where: { id: { in: deputies.docs.map((doc) => doc.id) } },
          depth: 0,
          overrideAccess: true,
          req,
        })
      }
    }

    // Per-id so `CampaignUser.beforeDelete` (passkeys + notifications) runs for
    // every account — bulk `where` deletes would skip the hooks.
    for (const accountID of accountIDs) {
      await payload.delete({
        collection: 'campaignUser',
        id: accountID,
        depth: 0,
        overrideAccess: true,
        req,
      })
    }

    let contactDeleted = false
    let contactAnonymized = false
    if (signatureCount > 0 || subscriptionCount > 0) {
      await anonymizeContact(payload, contactID, req)
      contactAnonymized = true
    } else {
      await payload.delete({
        collection: 'contact',
        id: contactID,
        depth: 0,
        overrideAccess: true,
        req,
      })
      contactDeleted = true
    }

    return {
      removed: true,
      contactDeleted,
      contactAnonymized,
      deletedAccounts: accountIDs.length,
    }
  })
