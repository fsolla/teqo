import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import type { Contact } from '@/payload-types'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneLocks'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'

type ContactIdentityRequest = PayloadTransactionRequest | PayloadRequest

/**
 * Find-or-create the normalized `Contact` ficha for a person, inside the
 * caller's transaction. With phones, the advisory locks are acquired HERE for
 * every typed number and an existing ficha that already carries the PRIMARY
 * (first) phone is reused — but only when that phone is unambiguous (exactly
 * one ficha): that is the phone-matching dedupe C6/C99 keeps for re-imports
 * and re-registration of the SAME person. When the primary phone already
 * belongs to TWO OR MORE fichas there is no person the phone can identify —
 * C111 — so a fresh ficha is created (the identity of the person being
 * created is the ficha just written; never a guess among the existing ones).
 * The remaining typed numbers follow the ficha wherever it lands: they fill
 * the fresh ficha, or are appended (only the ones it lacks, at the END — a
 * re-registration never reorders the mesa's priority). Without phones, a
 * fresh name-only ficha is created. Every "cria ou vincula a ficha" path
 * shares one owner for the "BA default + shared-phone" policy.
 *
 * Callers must already be inside an active Payload transaction (the advisory
 * lock requires it) and authorized to own the write (staff creation flows run
 * with the operation already gated; the intentional admin bypass mirrors
 * `createStateDeputyWithContact`).
 */
export const findOrCreateContactByPhone = async ({
  payload,
  req,
  phones,
  name,
  email,
  city,
  gender,
}: {
  payload: Payload
  req: ContactIdentityRequest
  phones: string[]
  name: string
  email?: string | null
  city?: string | null
  gender?: Contact['gender'] | null
}): Promise<{ contactID: number; reused: boolean }> => {
  const primary = phones[0] ?? null

  if (primary) {
    await acquireContactPhoneLocks(payload, req, phones)

    const contacts = await payload.find({
      collection: 'contact',
      // Matches ANY of the ficha's phones — the primary typed here is the
      // dedupe key, but it may sit at any position of the existing ficha.
      where: { 'phones.value': { equals: primary } },
      depth: 0,
      limit: 2,
      pagination: false,
      // Intentional admin bypass: the phone match must see every ficha,
      // including ones outside the actor's campaign scope.
      overrideAccess: true,
      req,
    })

    if (contacts.totalDocs === 1) {
      const existing = contacts.docs[0]!
      const existingPhones = (existing.phones ?? [])
        .map((entry) => entry.value)
        .filter((value): value is string => Boolean(value))
      const missing = phones.filter((phone) => !existingPhones.includes(phone))
      if (missing.length > 0) {
        await payload.update({
          collection: 'contact',
          id: existing.id,
          data: {
            phones: [...existingPhones, ...missing].map((value) => ({ value })),
          },
          depth: 0,
          overrideAccess: true,
          req,
        })
      }
      return { contactID: existing.id, reused: true }
    }
  }

  const contact = await payload.create({
    collection: 'contact',
    data: {
      name,
      phones: phones.map((value) => ({ value })),
      email: email ?? null,
      state: 'BA' as Contact['state'],
      city: city ?? null,
      gender,
    },
    depth: 0,
    overrideAccess: true,
    req,
  })

  return { contactID: contact.id, reused: false }
}
