// ---------------------------------------------------------------------------
// C193 — the private reel library (reel + reelMedia)
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { getFreshCampaignUser, isPayloadAdmin } from '@/utilities/access/shared'

/**
 * Readers/managers of the private reel library: Payload admin or campaign
 * users with the `communicator`, `coordinator` or `candidate` role. Advisors
 * and leaders are denied — the library is not municipality-scoped and not a
 * staff area.
 */
export const canReadReel: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadCommunicationCatalog(currentUser.role) : false
}

/**
 * Who may remove a reel (or one of its files): the same library audience plus
 * the Payload admin. Written as its own predicate, never an alias of
 * `canReadReel`, so a future widening of the read surface cannot silently
 * grant delete.
 */
export const canDeleteReel: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadCommunicationCatalog(currentUser.role) : false
}
