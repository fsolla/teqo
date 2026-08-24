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
 *
 * Ficha locks (C120 — `contact-ficha:<id>`) serialize the append-on-reuse
 * read-modify-write of ONE ficha: after the dedupe find commits to reusing a
 * ficha, the flow locks the ficha itself and RE-READS its phones inside the
 * lock before appending, so concurrent flows that reach the same ficha by
 * different primaries never drop each other's typed number (the per-phone
 * locks are disjoint in that case). Lock-order invariant: phone keys are
 * always acquired batched first, any entity/ficha key LAST and alone — no
 * flow ever holds a second entity key while requesting another, so there is
 * no cycle. Full-replace editors (supporter/leadership/contact phone fields,
 * tombstones) are NOT serialized by this key on purpose: an editor's
 * semantics is "the array is now exactly this", and a lock would not change
 * its last-writer-wins.
 */
export const contactPhoneLockKeys = (phones: string[]): string[] =>
  [...new Set(phones)].sort().map((phone) => `contact-phone:${phone}`)

export const contactFichaLockKey = (id: number | string): string => `contact-ficha:${id}`

export const acquireContactPhoneLocks = (
  payload: ContactPhonePayload,
  req: ContactPhoneRequest,
  phones: string[],
): Promise<void> => acquireTextAdvisoryLocks(payload, req, contactPhoneLockKeys(phones))

export const acquireContactFichaLock = (
  payload: ContactPhonePayload,
  req: ContactPhoneRequest,
  id: number | string,
): Promise<void> => acquireTextAdvisoryLocks(payload, req, [contactFichaLockKey(id)])
