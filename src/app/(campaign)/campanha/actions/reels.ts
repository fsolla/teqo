'use server'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import type { ReelStatus } from '@/lib/reel'
import {
  REEL_FORBIDDEN_MESSAGE,
  REEL_NOT_FOUND_MESSAGE,
  reelPublicationRequestSchema,
  type ReelPublicationRequest,
} from '@/lib/schemas/reel'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'

export type ReelPublicationResult = {
  id: number
  status: ReelStatus
}

/**
 * C194 — the kill switch of the reel library. `unpublished` takes the reel off
 * the list and withholds its files (the C193 media route serves only
 * `published`); `published` puts the same row back. The collection's
 * `beforeChange` stamps `publishedAt` on every transition into `published`, so
 * the order of the list always reflects the last publication.
 *
 * Single-collection, single-document write: no transaction (same precedent as
 * `setSpeechCutPublishedForActor`). The fresh role gate is repeated here so a
 * denied actor gets the domain message instead of a silent collection denial.
 */
export const setReelPublishedForActor = async (
  input: ReelPublicationRequest,
): Promise<ReelPublicationResult> => {
  const parsed = reelPublicationRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(REEL_FORBIDDEN_MESSAGE)

  const current = await payload.find({
    collection: 'reel',
    where: { id: { equals: parsed.reelId } },
    depth: 0,
    limit: 1,
    pagination: false,
    user: actor,
    overrideAccess: false,
  })
  if (!current.docs[0]) throw new Error(REEL_NOT_FOUND_MESSAGE)

  const reel = await payload.update({
    collection: 'reel',
    id: parsed.reelId,
    data: { status: parsed.published ? 'published' : 'unpublished' },
    depth: 0,
    user: actor,
    overrideAccess: false,
  })

  return { id: reel.id, status: reel.status }
}
