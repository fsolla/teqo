// ---------------------------------------------------------------------------
// C199 — recordings uploaded into the communication acervo
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { getFreshCampaignUser, isPayloadAdmin } from '@/utilities/access/shared'

/**
 * Readers of the uploaded recordings: Payload admin or campaign users with the
 * `communicator`, `coordinator` or `candidate` role. Advisors and leaders are
 * denied — the acervo is not municipality-scoped and not a staff area.
 */
export const canReadRecording: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadCommunicationCatalog(currentUser.role) : false
}

/**
 * Who may upload a recording (and the private media that belongs to it): the
 * same acervo audience plus the Payload admin. Written as its own predicate,
 * never an alias of `canReadRecording`, so a future widening of the read
 * surface cannot silently grant upload.
 */
export const canUploadRecording: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadCommunicationCatalog(currentUser.role) : false
}

/**
 * Who may remove a recording (row + transcript + private media): its own
 * predicate for the same reason as the upload one, mirroring `canDeleteReel`.
 */
export const canDeleteRecording: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser ? canReadCommunicationCatalog(currentUser.role) : false
}
