import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

type ContactPhonePayload = Pick<Payload, 'db'>
type ContactPhoneRequest = PayloadTransactionRequest | PayloadRequest

/**
 * Advisory locks keyed by phone (C111 — the phone is a contact channel, not a
 * unique person identity, so these serialize read-modify-write flows that
 * look contacts up by phone: find-or-create, CSV import, invite redemption,
 * LGPD tombstone). They no longer guard uniqueness — they prevent two
 * concurrent flows from racing the same phone key.
 */
export const contactPhoneLockKeys = (phones: string[]): string[] =>
  [...new Set(phones)].sort().map((phone) => `contact-phone:${phone}`)

export const acquireContactPhoneLocks = (
  payload: ContactPhonePayload,
  req: ContactPhoneRequest,
  phones: string[],
): Promise<void> => acquireTextAdvisoryLocks(payload, req, contactPhoneLockKeys(phones))
