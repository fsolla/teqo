// ---------------------------------------------------------------------------
// C231 — Flickr photo archive
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { getFreshCampaignUser, isPayloadAdmin } from '@/utilities/access/shared'

/**
 * Readers of the photo archive: Payload admin or campaign users with the
 * `communicator`, `coordinator` or `candidate` role — the same vertical gate as
 * the acervo de falas, the reels and the Central. Advisors and leaders are
 * denied (fail-closed): the raw archive is editorial material, not a
 * municipality-scoped staff area. C232 curates these same rows; the CLI
 * ingests with an explicit documented bypass.
 */
export const canReadArchivePhoto: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadCommunicationCatalog(currentUser.role) : false
}
