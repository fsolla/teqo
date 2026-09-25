// ---------------------------------------------------------------------------
// C211 — content pieces of the internal communication Central
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { getFreshCampaignUser, isPayloadAdmin } from '@/utilities/access/shared'

/**
 * Readers of the content pieces: Payload admin or campaign users with the
 * `communicator`, `coordinator` or `candidate` role — the same vertical gate as
 * the acervo and the reels. Advisors and leaders are denied (fail-closed): the
 * Central is editorial material, not a municipality-scoped staff area.
 */
export const canReadContentPiece: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadCommunicationCatalog(currentUser.role) : false
}

/**
 * Who may add a piece to the Central (upload, link, attach the original file):
 * the same audience. Written as its own predicate, never an alias of
 * `canReadContentPiece`, so a future widening of the read surface cannot
 * silently grant writes.
 */
export const canCreateContentPiece: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadCommunicationCatalog(currentUser.role) : false
}

/**
 * Who may edit a piece's catalogue and move the kill switch. Its own predicate
 * for the same reason as the create one.
 */
export const canUpdateContentPiece: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadCommunicationCatalog(currentUser.role) : false
}

/**
 * Who may delete a piece for good (C222). The same vertical gate plus the
 * Payload admin — and its own predicate, never an alias of the update one: a
 * future widening of the edit surface must not silently grant an irreversible
 * delete. The confirmation dialog is the brake, not a narrower role.
 */
export const canDeleteContentPiece: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadCommunicationCatalog(currentUser.role) : false
}
