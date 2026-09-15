import 'server-only'

import type { Payload } from 'payload'

import type { SpeechCutRecordForView } from '@/lib/speechCut'
import type { CampaignUser } from '@/payload-types'

/**
 * C167/C168 — the one read of one cut by id, with the origin speech expanded
 * (depth 1). The C167 actions use it to inspect/return a cut and the C168
 * library detail loader uses it to throw the named not-found error — same
 * query, `overrideAccess: false` against the actor's access.
 */
export const findSpeechCutForActor = async (
  payload: Payload,
  actor: CampaignUser,
  cutId: number,
): Promise<SpeechCutRecordForView | null> => {
  const result = await payload.find({
    collection: 'speechCut',
    where: { id: { equals: cutId } },
    depth: 1,
    limit: 1,
    pagination: false,
    user: actor,
    overrideAccess: false,
  })
  return result.docs[0] ?? null
}
