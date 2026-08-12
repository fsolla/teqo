import 'server-only'

import type { Payload } from 'payload'

import { uniqueRelationshipIds } from '@/lib/relationship'
import {
  PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE,
  PERSON_CAPACITY_EXIT_SCOPE_MESSAGE,
  type PersonCapacityExitInput,
} from '@/lib/schemas/personCell'
import type { CampaignUser, StateDeputy } from '@/payload-types'
import { getAdvisorMunicipalityIds, isCampaignUnrestricted } from '@/utilities/campaignAccess'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'

/**
 * C128 — the destructive-exit contract of the people list: when the LAST
 * municipality of a capacity leaves the row, the entity (staff account,
 * leadership, dobradinha) dies server-side. Two guards, shared by the exit
 * write (inside the transaction) and the confirmation manifest (read-only
 * preview) so the dialog can never describe a destruction the write would
 * refuse, or vice-versa.
 *
 * - Scope (Lidera / Aliada em): coordinator/candidate always pass; an advisor
 *   only passes when EVERY municipality the capacity currently holds is in his
 *   carteira — the chips visibility already prevents the gesture otherwise,
 *   this is the server-side re-check ("o piso dele é a visibilidade").
 * - Account (Assessora): coordinator/candidate only — the intent's gate
 *   decision (criação/remoção de conta staff é coordenação/candidato).
 *
 * The manifest is a preview, never the authority: the exit write re-enumerates
 * inside its transaction (same contract as `loadPersonDeleteManifest`).
 */

export type PersonCapacityExitManifest =
  | {
      capacity: 'leadership'
      declaredVoteCount: number
      inviteCount: number
      municipalityNames: string[]
    }
  | {
      capacity: 'account'
      accountName: string
      authored: {
        inviteCount: number
        updateCount: number
        feedCount: number
        importBatchCount: number
      }
      assessorado: { leadershipNames: string[]; deputyNames: string[]; activityNames: string[] }
    }

type CapacityExitPayload = Pick<Payload, 'find' | 'count' | 'findByID'>

export const assertPersonCapacityExitScope = async (
  payload: CapacityExitPayload,
  currentActor: CampaignUser,
  req: PayloadTransactionRequest | undefined,
  currentMunicipalityIDs: readonly number[],
): Promise<void> => {
  if (isCampaignUnrestricted(currentActor)) return
  if (currentActor.role !== 'advisor') {
    throw new Error(PERSON_CAPACITY_EXIT_SCOPE_MESSAGE)
  }

  const administered = new Set(await getAdvisorMunicipalityIds(payload, currentActor.id, req))
  const outside = currentMunicipalityIDs.filter((id) => !administered.has(id))
  if (outside.length > 0) {
    throw new Error(PERSON_CAPACITY_EXIT_SCOPE_MESSAGE)
  }
}

const assessoradoNamesOf = async (
  payload: CapacityExitPayload,
  accountID: number,
  req: PayloadTransactionRequest | undefined,
): Promise<{ leadershipNames: string[]; deputyNames: string[]; activityNames: string[] }> => {
  const [leaderships, deputies, activities] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: { advisors: { contains: accountID } },
      depth: 1,
      limit: 0,
      pagination: false,
      select: { contact: true },
      // Intentional admin bypass: the unrestricted gate (or the exit scope) is
      // the authorization; the manifest only resolves names to display.
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'stateDeputy',
      where: { advisors: { contains: accountID } },
      depth: 1,
      limit: 0,
      pagination: false,
      select: { contact: true },
      // Intentional admin bypass: same gate as the leadership read above.
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'activity',
      where: { responsible: { equals: { relationTo: 'campaignUser', value: accountID } } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { title: true },
      // Intentional admin bypass: same gate as the leadership read above.
      overrideAccess: true,
      req,
    }),
  ])

  const nameOf = (contact: unknown): string =>
    contact !== null && typeof contact === 'object' && 'name' in contact
      ? String((contact as { name: unknown }).name ?? 'Contato')
      : 'Contato'

  return {
    leadershipNames: leaderships.docs.map((doc) => nameOf((doc as { contact: unknown }).contact)),
    deputyNames: deputies.docs.map((doc) => nameOf((doc as StateDeputy).contact)),
    activityNames: activities.docs
      .map((doc) => (doc as { title?: string | null }).title ?? 'Atividade')
      .filter(Boolean),
  }
}

/**
 * Read-only preview of what the destructive exit removes. `null` means there
 * is nothing to destroy (no entity for the capacity) — the caller commits the
 * plain municipality change (a server no-op) without a dialog. Throws on the
 * scope refusals so the dialog never opens for a destruction that would fail.
 */
export const loadPersonCapacityExitManifest = async (
  payload: CapacityExitPayload,
  actor: CampaignUser,
  input: PersonCapacityExitInput,
  req?: PayloadTransactionRequest,
): Promise<PersonCapacityExitManifest | null> => {
  if (input.capacity === 'account') {
    if (!isCampaignUnrestricted(actor)) {
      throw new Error(PERSON_CAPACITY_EXIT_SCOPE_MESSAGE)
    }

    const accounts = await payload.find({
      collection: 'campaignUser',
      where: { contact: { equals: input.contactId } },
      depth: 0,
      limit: 2,
      pagination: false,
      select: { name: true },
      // Intentional admin bypass: the unrestricted gate above is the
      // authorization; `contact` is identity-gated and only counted here.
      overrideAccess: true,
      req,
    })
    if (accounts.docs.length === 0) return null
    if (accounts.docs.length > 1) {
      throw new Error(PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE)
    }
    const accountID = Number(accounts.docs[0].id)

    const [invites, updates, feeds, batches, assessorado] = await Promise.all([
      // Intentional admin bypass: the unrestricted gate above is the
      // authorization; these counts only size the manifest list.
      payload.count({
        collection: 'campaignInvite',
        where: { createdBy: { equals: accountID } },
        overrideAccess: true,
        req,
      }),
      payload.count({
        collection: 'municipalityUpdate',
        where: { author: { equals: accountID } },
        // Intentional admin bypass: same unrestricted gate as above.
        overrideAccess: true,
        req,
      }),
      payload.count({
        collection: 'calendarFeed',
        where: { createdBy: { equals: accountID } },
        // Intentional admin bypass: same unrestricted gate as above.
        overrideAccess: true,
        req,
      }),
      // Intentional admin bypass: same unrestricted gate as above.
      payload.count({
        collection: 'supporterImportBatch',
        where: { actor: { equals: accountID } },
        overrideAccess: true,
        req,
      }),
      assessoradoNamesOf(payload, accountID, req),
    ])

    return {
      capacity: 'account',
      accountName: accounts.docs[0].name,
      authored: {
        inviteCount: invites.totalDocs,
        updateCount: updates.totalDocs,
        feedCount: feeds.totalDocs,
        importBatchCount: batches.totalDocs,
      },
      assessorado,
    }
  }

  const leaderships = await payload.find({
    collection: 'leadership',
    where: { contact: { equals: input.contactId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { id: true, municipalities: true },
    user: actor,
    overrideAccess: false,
  })
  if (leaderships.docs.length === 0) return null
  const leadershipID = leaderships.docs[0].id

  const currentMunicipalityIDs = uniqueRelationshipIds(
    (leaderships.docs[0] as { municipalities: unknown[] }).municipalities,
  )
  await assertPersonCapacityExitScope(payload, actor, req, currentMunicipalityIDs)

  const [pledges, invites, municipalities] = await Promise.all([
    payload.find({
      collection: 'votePledge',
      where: { leadership: { equals: leadershipID } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { declaredVotes: true },
      // Intentional admin bypass: the exit scope was checked above; the
      // manifest only sums the votes the deletion would remove.
      overrideAccess: true,
      req,
    }),
    payload.count({
      collection: 'campaignInvite',
      where: { leadership: { equals: leadershipID } },
      // Intentional admin bypass: same exit scope as the pledges read above.
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'municipality',
      where: { id: { in: currentMunicipalityIDs } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { name: true },
      // Intentional admin bypass: same exit scope as the pledges read above.
      overrideAccess: true,
      req,
    }),
  ])

  const nameById = new Map(
    municipalities.docs.map((municipality) => [municipality.id, municipality.name] as const),
  )

  return {
    capacity: 'leadership',
    declaredVoteCount: pledges.docs.reduce(
      (sum, pledge) =>
        sum +
        (typeof (pledge as { declaredVotes?: number | null }).declaredVotes === 'number'
          ? ((pledge as { declaredVotes: number }).declaredVotes ?? 0)
          : 0),
      0,
    ),
    inviteCount: invites.totalDocs,
    municipalityNames: currentMunicipalityIDs
      .map((id) => nameById.get(id))
      .filter((name): name is string => name !== undefined),
  }
}
