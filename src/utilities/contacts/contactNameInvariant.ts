import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import { CONTACT_NAME_CONFLICT_MESSAGE } from '@/lib/schemas/contact'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

type ContactNameRequest = Pick<PayloadRequest, 'transactionID'>

/**
 * C139 — the Contact ficha is the "person" record and the contacts page lets
 * staff edit names in place, so the name becomes a first-class lookup key:
 * normalize (trim + collapse whitespace + lowercase), compare exactly on the
 * normalized form. The DB query is only a case-insensitive substring
 * prefilter (the Postgres adapter has no normalized-equality operator); the
 * verdict is the in-memory exact check.
 */
export const normalizeContactName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').toLowerCase()

export const assertContactNameAvailable = async (
  payload: Pick<Payload, 'db' | 'find'>,
  req: ContactNameRequest,
  name: string,
  contactID?: number,
): Promise<void> => {
  const normalized = normalizeContactName(name)

  if (req.transactionID !== undefined && req.transactionID !== null) {
    await acquireTextAdvisoryLocks(payload, req, [`contact-name:${normalized}`])
  }

  const candidates = await payload.find({
    collection: 'contact',
    where: {
      and: [
        { name: { like: normalized } },
        ...(contactID === undefined ? [] : [{ id: { not_equals: contactID } }]),
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true },
    // Intentional bypass: the invariant must see rows outside the current
    // actor scope (same rationale as the stateDeputy name invariant).
    overrideAccess: true,
    req,
  })

  const conflict = (candidates.docs as { name: string }[]).some(
    (doc) => normalizeContactName(doc.name) === normalized,
  )
  if (conflict) throw new Error(CONTACT_NAME_CONFLICT_MESSAGE)
}
