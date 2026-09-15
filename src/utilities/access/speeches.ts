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

/**
 * C167 — a cut is public by link when `published`; every other status (and the
 * internal `error`/`step`) stays behind the acervo gate. Returning a `where`
 * for the anonymous reader keeps REST/GraphQL from listing drafts, while the
 * public page reads with the default override and filters `published` itself,
 * the same contract as `Petition.enabled`.
 */
export const canReadSpeechCut: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser && canReadSpeechCatalog(currentUser.role)
    ? true
    : { status: { equals: 'published' } }
}
