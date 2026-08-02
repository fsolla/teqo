import type { Payload } from 'payload'

import { assertOpsUpdatedAtCas } from '@/lib/schemas/opsCas'
import type { CampaignUser } from '@/payload-types'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'

type CasCollection = 'leadership' | 'campaignDemand' | 'activity' | 'stateDeputy' | 'municipality'

/**
 * OH13 — shared CAS gate used by domain writes (3+ call sites). When armed,
 * loads the doc's `updatedAt` under the actor's row access and refuses on
 * mismatch. Does not replace RBAC or wrap the mutation itself.
 */
export const assertCampaignDocCas = async (
  payload: Payload,
  args: {
    collection: CasCollection
    id: number
    actor: CampaignUser
    enforceCas: boolean
    baseUpdatedAt: string | null | undefined
    req?: PayloadTransactionRequest
  },
): Promise<void> => {
  if (!args.enforceCas || args.baseUpdatedAt === undefined) return

  const current = await payload.findByID({
    collection: args.collection,
    id: args.id,
    depth: 0,
    select: { updatedAt: true },
    user: args.actor,
    overrideAccess: false,
    ...(args.req ? { req: args.req } : {}),
  })

  assertOpsUpdatedAtCas(true, args.baseUpdatedAt, current.updatedAt)
}
