import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import {
  acquireTextAdvisoryLocks,
  POSTGRES_DEDUP_LOCK_MESSAGE,
} from '@/utilities/postgresTransactionLocks'

export const CONTACT_PHONE_CONFLICT_MESSAGE = 'Já existe outro contato com este celular.'

/**
 * Several contacts share the phone — a data-quality problem only an admin can
 * resolve. Thrown by the upsert paths and matched verbatim by `safeMessages`.
 */
export const CONTACT_PHONE_AMBIGUOUS_MESSAGE =
  'Existe mais de um contato com este celular. Resolva a duplicidade no admin antes de continuar.'

type ContactPhonePayload = Pick<Payload, 'db' | 'find' | 'findByID'>
type ContactPhoneRequest = PayloadTransactionRequest | PayloadRequest

export const contactPhoneLockKeys = (phones: string[]): string[] =>
  [...new Set(phones)].sort().map((phone) => `contact-phone:${phone}`)

export const acquireContactPhoneLocks = (
  payload: Pick<Payload, 'db'>,
  req: ContactPhoneRequest,
  phones: string[],
): Promise<void> => acquireTextAdvisoryLocks(payload, req, contactPhoneLockKeys(phones))

export const assertContactPhoneAvailable = async (
  payload: ContactPhonePayload,
  req: ContactPhoneRequest,
  phone: string,
  contactID?: number,
  conflictMessage = CONTACT_PHONE_CONFLICT_MESSAGE,
): Promise<void> => {
  const conflicts = await payload.find({
    collection: 'contact',
    where: {
      and: [
        { phone: { equals: phone } },
        ...(contactID === undefined ? [] : [{ id: { not_equals: contactID } }]),
      ],
    },
    depth: 0,
    limit: 1,
    pagination: false,
    // Intentional admin bypass: the uniqueness invariant must see EVERY contact
    // with the phone, including ones the actor cannot read — a scoped check
    // would let duplicates slip in through the invisible half of the table.
    overrideAccess: true,
    req,
  })
  if (conflicts.totalDocs > 0) throw new Error(conflictMessage)
}

/**
 * Checks the phone invariant for an already-authorized Contact update. The
 * caller must prove access to the owning campaign join before using the
 * intentional admin-bypass reads/writes here.
 */
export const assertContactPhoneWritable = async (
  payload: ContactPhonePayload,
  req: ContactPhoneRequest,
  contactID: number,
  phone: string,
): Promise<void> => {
  if (payload.db.name !== 'postgres') {
    throw new Error(POSTGRES_DEDUP_LOCK_MESSAGE)
  }

  const currentContact = await payload.findByID({
    collection: 'contact',
    id: contactID,
    depth: 0,
    select: { phone: true },
    // Intentional admin bypass: the caller has already proved ownership through
    // the campaign join; this read only obtains the old value for lock ordering.
    overrideAccess: true,
    req,
  })
  const oldPhone = currentContact.phone ?? undefined

  // Lock both sides before checking availability. This prevents concurrent
  // swaps (A -> B and B -> A) from waiting on each other's hook locks.
  await acquireContactPhoneLocks(
    payload,
    req,
    [oldPhone, phone].filter((value): value is string => Boolean(value)),
  )

  const contactsWithPhone = await payload.find({
    collection: 'contact',
    where: { phone: { equals: phone } },
    depth: 0,
    limit: 2,
    pagination: false,
    // Intentional admin bypass: phone uniqueness must see every Contact,
    // including one outside the actor's campaign scope.
    overrideAccess: true,
    req,
  })

  if (contactsWithPhone.totalDocs > 1) {
    throw new Error(CONTACT_PHONE_AMBIGUOUS_MESSAGE)
  }

  const phoneOwner = contactsWithPhone.docs[0]
  if (phoneOwner && phoneOwner.id !== contactID) {
    await assertContactPhoneAvailable(payload, req, phone, contactID)
  }
}
