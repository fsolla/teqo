import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import type { Contact } from '@/payload-types'
import {
  acquireContactPhoneLocks,
  CONTACT_PHONE_AMBIGUOUS_MESSAGE,
} from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'

type ContactIdentityRequest = PayloadTransactionRequest | PayloadRequest

/**
 * Find-or-create the normalized `Contact` ficha for a person, inside the
 * caller's transaction. With a phone, the advisory lock is acquired HERE and
 * an existing ficha with that phone is reused (ambiguous phone fails
 * closed) — the same critical section the supporter flows used to build
 * around `upsertContactByPhone`. Without a phone, a fresh name-only ficha is
 * created. Every "cria ou vincula a ficha" path shares one owner for the
 * "BA default + ambiguous-phone fail-closed" policy.
 *
 * Callers must already be inside an active Payload transaction (the advisory
 * lock requires it) and authorized to own the write (staff creation flows run
 * with the operation already gated; the intentional admin bypass mirrors
 * `createStateDeputyWithContact`).
 */
export const findOrCreateContactByPhone = async ({
  payload,
  req,
  phone,
  name,
  email,
  city,
  gender,
}: {
  payload: Payload
  req: ContactIdentityRequest
  phone: string | null
  name: string
  email?: string | null
  city?: string | null
  gender?: Contact['gender'] | null
}): Promise<{ contactID: number; reused: boolean }> => {
  if (phone) {
    await acquireContactPhoneLocks(payload, req, [phone])

    const contacts = await payload.find({
      collection: 'contact',
      where: { phone: { equals: phone } },
      depth: 0,
      limit: 2,
      pagination: false,
      // Intentional admin bypass: the phone invariant must see every ficha,
      // including ones outside the actor's campaign scope.
      overrideAccess: true,
      req,
    })

    if (contacts.totalDocs > 1) {
      throw new Error(CONTACT_PHONE_AMBIGUOUS_MESSAGE)
    }

    const existing = contacts.docs[0]
    if (existing) {
      return { contactID: existing.id, reused: true }
    }
  }

  const contact = await payload.create({
    collection: 'contact',
    data: {
      name,
      phone,
      email: email ?? null,
      state: 'BA' as Contact['state'],
      city: city ?? null,
      gender,
    },
    depth: 0,
    overrideAccess: true,
    // With a phone, the advisory lock is held for this transaction and the
    // find above already proved the phone is free — the Contact
    // phone-invariant hook can skip its redundant lock+availability check
    // (same contract as the C6 bulk-import path, fail-closed on a missing
    // transaction). Without a phone there is no uniqueness to enforce.
    ...(phone ? { context: { skipContactPhoneInvariant: true as const } } : {}),
    req,
  })

  return { contactID: contact.id, reused: false }
}
