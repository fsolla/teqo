import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

export const CONTACT_PHONE_CONFLICT_MESSAGE = 'Já existe outro contato com este celular.'

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
    overrideAccess: true,
    req,
  })
  if (conflicts.totalDocs > 0) throw new Error(conflictMessage)
}
