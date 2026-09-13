// ---------------------------------------------------------------------------
// Speech catalog (C153) — the "acervo de falas" read surface
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import { canReadSpeechCatalog } from '@/lib/campaignRoles'
import {
  getFreshCampaignUser,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'

/**
 * Readers of the speech catalog: Payload admin or campaign users with the
 * `communicator`, `coordinator` or `candidate` role. Advisors and leaders are
 * denied — the catalog is not municipality-scoped and not a staff area.
 */
export const canReadSpeech: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadSpeechCatalog(currentUser.role) : false
}

/** Manual facet correction — unrestricted roles (and Payload admin) only. */
export const canUpdateSpeech: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignUnrestricted(await getFreshCampaignUser(req))
}
