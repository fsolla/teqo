import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

export const CONTACT_PHONE_CONFLICT_MESSAGE = 'Já existe outro contato com este celular.'

/**
 * Several contacts share the phone — a data-quality problem only an admin can
 * resolve. Thrown by the upsert paths and matched verbatim by `safeMessages`.
 */
export const CONTACT_PHONE_AMBIGUOUS_MESSAGE =
  'Existe mais de um contato com este celular. Resolva a duplicidade no admin antes de continuar.'

type ContactPhonePayload = Pick<Payload, 'db' | 'find'>
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
