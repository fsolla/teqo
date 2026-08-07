import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import { STATE_DEPUTY_CONFLICT_MESSAGE } from '@/lib/schemas/stateDeputy'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

type StateDeputyNameRequest = Pick<PayloadRequest, 'transactionID'>

/**
 * Keeps the historical unique-name rule at the StateDeputy boundary even
 * though the name now lives on Contact and Contact is shared by other joins.
 */
export const assertStateDeputyNameAvailable = async (
  payload: Pick<Payload, 'db' | 'find'>,
  req: StateDeputyNameRequest,
  name: string,
  stateDeputyID?: number,
): Promise<void> => {
  const normalizedName = name.trim()

  if (req.transactionID !== undefined && req.transactionID !== null) {
    await acquireTextAdvisoryLocks(payload, req, [`state-deputy-name:${normalizedName}`])
  }

  const conflicts = await payload.find({
    collection: 'stateDeputy',
    where: {
      and: [
        { 'contact.name': { equals: normalizedName } },
        ...(stateDeputyID === undefined ? [] : [{ id: { not_equals: stateDeputyID } }]),
      ],
    },
    depth: 0,
    limit: 1,
    pagination: false,
    // Intentional bypass: the invariant must see rows outside the current
    // advisor scope.
    overrideAccess: true,
    req,
  })

  if (conflicts.totalDocs > 0) throw new Error(STATE_DEPUTY_CONFLICT_MESSAGE)
}
