import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { isContactSearchQueryReady, normalizeContactSearchQuery } from '@/lib/contactSearchQuery'
import { CONTENT_PIECE_LEADER_SEARCH_LIMIT } from '@/lib/contentPiece'
import { isPopulatedRelationship, relationshipId } from '@/lib/relationship'
import type { CampaignUser, Contact, Leadership } from '@/payload-types'

export type ContentPieceLeaderOption = { id: number; label: string }

const leaderOptionOf = (leadership: Leadership): ContentPieceLeaderOption | null => {
  const id = relationshipId(leadership.id)
  const contact = leadership.contact
  if (!id || !isPopulatedRelationship<Contact>(contact)) return null
  const label = contact.name.trim()
  return label ? { id, label } : null
}

/** The options in the requested id order, skipping ids that no longer resolve. */
const orderOptionsById = (
  options: readonly ContentPieceLeaderOption[],
  ids: readonly number[],
): ContentPieceLeaderOption[] => {
  const byId = new Map(options.map((option) => [option.id, option]))
  return ids
    .map((id) => byId.get(id))
    .filter((option): option is ContentPieceLeaderOption => option !== undefined)
}

/**
 * The one read of `leadership` behind the ficha picker and the name snapshot.
 * The `select` reads only the contact relation (the source of the label) and
 * the `{ id, label }` mapping is the boundary that guarantees only the display
 * name leaves — no phone, municipality, organization, status or votes of a
 * leadership is returned (the int tests assert the returned shape).
 */
const findLeaderOptions = async (
  payload: Pick<Payload, 'find'>,
  req: PayloadRequest | undefined,
  where: Parameters<Payload['find']>[0]['where'],
  limit: number,
): Promise<ContentPieceLeaderOption[]> => {
  const result = await payload.find({
    collection: 'leadership',
    where,
    depth: 1,
    limit,
    select: { contact: true },
    // S37 intentional admin bypass (approved in the plan, D1): the candidate
    // list needs the display name of leaderships the communication role cannot
    // read through the RBAC (it is the role that edits the ficha). Only the
    // name of the projection above is read or returned; `overrideAccess: false`
    // would blind the picker for the very persona that operates the Central.
    overrideAccess: true,
    req,
  })

  return result.docs
    .map((doc) => leaderOptionOf(doc as Leadership))
    .filter((option): option is ContentPieceLeaderOption => option !== null)
}

/**
 * The selected leaders' `{ id, label }` in the requested order (the ficha
 * chips). Fail-closed: a role outside the communication gate gets an empty
 * list, never a leaked name.
 */
export const resolveContentPieceLeaderOptions = async (
  payload: Pick<Payload, 'find'>,
  actor: Pick<CampaignUser, 'role'>,
  ids: readonly number[],
): Promise<ContentPieceLeaderOption[]> => {
  if (!canReadCommunicationCatalog(actor.role)) return []

  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return []

  const options = await findLeaderOptions(
    payload,
    undefined,
    { id: { in: uniqueIds } },
    uniqueIds.length,
  )
  return orderOptionsById(options, uniqueIds)
}

/**
 * The gated async search of the ficha picker (2+ chars, bounded page). Same
 * fail-closed gate as the resolver; the caller action maps the denial to the
 * vertical's forbidden message.
 */
export const searchContentPieceLeaderOptions = async (
  payload: Pick<Payload, 'find'>,
  actor: Pick<CampaignUser, 'role'>,
  query: string,
): Promise<ContentPieceLeaderOption[]> => {
  if (!canReadCommunicationCatalog(actor.role)) return []

  const rawQuery = typeof query === 'string' ? query : ''
  if (!isContactSearchQueryReady(rawQuery)) return []

  const { trimmed } = normalizeContactSearchQuery(rawQuery)
  const options = await findLeaderOptions(
    payload,
    undefined,
    { 'contact.name': { contains: trimmed } },
    CONTENT_PIECE_LEADER_SEARCH_LIMIT,
  )
  return options.sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))
}

/**
 * S37 — the system-context snapshot: the display names of the linked leaders,
 * in the relation's order, skipping members that no longer resolve. Called by
 * the collection hook (inside the caller's transaction) to denormalize
 * `leaderNames`, so the public read never joins `leadership`.
 */
export const resolveContentPieceLeaderNames = async (
  payload: Pick<Payload, 'find'>,
  req: PayloadRequest,
  ids: readonly number[],
): Promise<string[]> => {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return []

  const options = await findLeaderOptions(payload, req, { id: { in: uniqueIds } }, uniqueIds.length)
  return orderOptionsById(options, uniqueIds).map((option) => option.label)
}
