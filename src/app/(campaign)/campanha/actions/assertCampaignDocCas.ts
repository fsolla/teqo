import type { Payload } from 'payload'

import { assertOpsUpdatedAtCas } from '@/lib/schemas/opsCas'
import type { CampaignUser } from '@/payload-types'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

type CasCollection = 'leadership' | 'campaignDemand' | 'activity' | 'stateDeputy' | 'municipality'

/** Shared advisory-lock key for document CAS — form + relation writers must agree. */
export const campaignDocCasLockKey = (collection: CasCollection, id: number): string =>
  `campaign-doc-cas:${collection}:${id}`

/**
 * OH13 / Pass 5 P1b — shared CAS gate. When armed, acquires a per-document
 * advisory lock, re-reads `updatedAt` under the actor's row access, and refuses
 * on mismatch. Callers must pass an active transaction `req` whenever CAS is
 * enforced — check-then-write without a lock is not CAS.
 */
export const assertCampaignDocCas = async (
  payload: Payload,
  args: {
    collection: CasCollection
    id: number
    actor: CampaignUser
    enforceCas: boolean
    baseUpdatedAt: string | null | undefined
    req: PayloadTransactionRequest
  },
): Promise<void> => {
  if (!args.enforceCas || args.baseUpdatedAt === undefined) return

  await acquireTextAdvisoryLocks(payload, args.req, [
    campaignDocCasLockKey(args.collection, args.id),
  ])

  const current = await payload.findByID({
    collection: args.collection,
    id: args.id,
    depth: 0,
    select: { updatedAt: true },
    user: args.actor,
    overrideAccess: false,
    req: args.req,
  })

  assertOpsUpdatedAtCas(true, args.baseUpdatedAt, current.updatedAt)
}
