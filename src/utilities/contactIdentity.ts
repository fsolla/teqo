import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import type { Contact } from '@/payload-types'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneLocks'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'

type ContactIdentityRequest = PayloadTransactionRequest | PayloadRequest

/**
 * Find-or-create the normalized `Contact` ficha for a person, inside the
 * caller's transaction. With a phone, the advisory lock is acquired HERE and
 * an existing ficha with that phone is reused — but only when the phone is
 * unambiguous (exactly one ficha): that is the phone-matching dedupe C6/C99
 * keeps for re-imports and re-registration of the SAME person. When the phone
 * already belongs to TWO OR MORE fichas there is no person the phone can
 * identify — C111 — so a fresh ficha is created (the identity of the person
 * being created is the ficha just written; never a guess among the existing
 * ones). Without a phone, a fresh name-only ficha is created. Every "cria ou
 * vincula a ficha" path shares one owner for the "BA default + shared-phone"
 * policy.
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
      // Intentional admin bypass: the phone match must see every ficha,
      // including ones outside the actor's campaign scope.
      overrideAccess: true,
      req,
    })

    if (contacts.totalDocs === 1) {
      return { contactID: contacts.docs[0]!.id, reused: true }
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
    req,
  })

  return { contactID: contact.id, reused: false }
}
