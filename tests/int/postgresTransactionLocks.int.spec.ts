// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import {
  contactPhoneLockKeys,
  CONTACT_PHONE_CONFLICT_MESSAGE,
} from '@/utilities/contactPhoneInvariant'
import {
  acquireTextAdvisoryLocks,
  getPostgresTransactionDatabase,
  type PostgresTransactionDatabase,
} from '@/utilities/postgresTransactionLocks'
import {
  getTestTransactionBackendPID,
  waitForAdvisoryLockWaiter,
} from '../helpers/testDatabaseLease'

let payload: Payload

/**
 * Recursively flattens a drizzle-orm `SQL` object's `queryChunks` down to the
 * raw string bind params (skipping the `StringChunk` text fragments), so the
 * mocked test below can assert which keys were sent in a single round trip.
 */
const collectLockParams = (query: unknown): string[] => {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? []
  return chunks.flatMap((chunk): string[] => {
    if (typeof chunk === 'string') return [chunk]
    if (chunk && typeof chunk === 'object' && 'queryChunks' in chunk) {
      return collectLockParams(chunk)
    }
    return []
  })
}

const beginTransaction = async (): Promise<{
  req: { transactionID: number | string }
  transaction: PostgresTransactionDatabase
  transactionID: number | string
}> => {
  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null) throw new Error('Expected a PostgreSQL transaction.')
  const req = { transactionID }
  const transaction = await getPostgresTransactionDatabase(payload, req)
  return { req, transaction, transactionID }
}

const rollback = async (...transactionIDs: Array<number | string>): Promise<void> => {
  await Promise.all(
    transactionIDs.map((transactionID) => payload.db.rollbackTransaction(transactionID)),
  )
}

describe('PostgreSQL transaction advisory locks', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('builds one canonical sorted contact-phone namespace for creates and changes', () => {
    expect(contactPhoneLockKeys(['71999990002', '71999990001', '71999990002'])).toEqual([
      'contact-phone:71999990001',
      'contact-phone:71999990002',
    ])
    expect(CONTACT_PHONE_CONFLICT_MESSAGE).toBe(
      'Já existe outro contato com este celular.',
    )
  })

  it('uses only the exact Payload transaction session and fails closed without it', async () => {
    const sessionDatabase = { execute: vi.fn().mockResolvedValue(undefined) }
    const unrelatedDatabase = { execute: vi.fn().mockResolvedValue(undefined) }
    const fixture = {
      db: {
        name: 'postgres',
        sessions: {
          '41': { db: sessionDatabase },
          '42': { db: unrelatedDatabase },
        },
      },
    }

    await expect(
      getPostgresTransactionDatabase(fixture as never, {
        transactionID: Promise.resolve(41),
      }),
    ).resolves.toBe(sessionDatabase)
    await acquireTextAdvisoryLocks(fixture as never, { transactionID: 41 }, [
      'domain:2',
      'domain:1',
      'domain:1',
    ])
    // Batched: all (deduplicated, sorted) keys go out in exactly one round trip.
    expect(sessionDatabase.execute).toHaveBeenCalledTimes(1)
    const [[query]] = sessionDatabase.execute.mock.calls
    expect(collectLockParams(query)).toEqual(['domain:1', 'domain:2'])
    expect(unrelatedDatabase.execute).not.toHaveBeenCalled()

    await expect(getPostgresTransactionDatabase(fixture as never, {})).rejects.toThrow(
      'A transação PostgreSQL não está disponível.',
    )
    await expect(
      acquireTextAdvisoryLocks(fixture as never, {}, ['domain:1']),
    ).rejects.toThrow('A transação PostgreSQL não está disponível.')
    await expect(
      getPostgresTransactionDatabase(fixture as never, { transactionID: 99 }),
    ).rejects.toThrow('A sessão PostgreSQL da transação não está disponível.')
  })

  it('rejects invalid text keys before acquiring any lock', async () => {
    const database = { execute: vi.fn().mockResolvedValue(undefined) }
    const fixture = {
      db: {
        name: 'postgres',
        sessions: { '51': { db: database } },
      },
    }

    await expect(
      acquireTextAdvisoryLocks(fixture as never, { transactionID: 51 }, [
        'valid:key',
        '   ',
      ]),
    ).rejects.toThrow('A chave do bloqueio PostgreSQL deve ser um texto não vazio.')
    expect(database.execute).not.toHaveBeenCalled()
  })

  it('serializes the same namespace and exposes its stable text hash in pg_locks', async () => {
    const first = await beginTransaction()
    const second = await beginTransaction()
    const key = `phase2c:same:${Date.now()}`

    try {
      await acquireTextAdvisoryLocks(payload, first.req, [key])
      const waiterPID = await getTestTransactionBackendPID(payload, second.transactionID)
      const pending = acquireTextAdvisoryLocks(payload, second.req, [key])
      const waiting = await waitForAdvisoryLockWaiter(payload, {
        key,
        mode: 'ExclusiveLock',
        waiterPID,
      })

      expect(waiting).toMatchObject({
        classID: waiting.expectedClassID,
        granted: false,
        objectID: waiting.expectedObjectID,
        objectSubID: 1,
        pid: waiterPID,
      })
      await payload.db.rollbackTransaction(first.transactionID)
      await pending
      await payload.db.rollbackTransaction(second.transactionID)
    } catch (error) {
      await rollback(first.transactionID, second.transactionID).catch(() => undefined)
      throw error
    }
  })

  it('allows different domains with the same entity ID to overlap', async () => {
    const first = await beginTransaction()
    const second = await beginTransaction()
    const entityID = Date.now()

    try {
      await acquireTextAdvisoryLocks(payload, first.req, [`vote-estimate:${entityID}`])
      await expect(
        acquireTextAdvisoryLocks(payload, second.req, [`nucleus-updates:${entityID}`]),
      ).resolves.toBeUndefined()
    } finally {
      await rollback(first.transactionID, second.transactionID)
    }
  })

  it('sorts and deduplicates multiple keys so opposite input orders cannot deadlock', async () => {
    const first = await beginTransaction()
    const second = await beginTransaction()
    const prefix = `phase2c:order:${Date.now()}`
    const low = `${prefix}:a`
    const high = `${prefix}:b`

    try {
      await acquireTextAdvisoryLocks(payload, first.req, [high, low, high])
      const waiterPID = await getTestTransactionBackendPID(payload, second.transactionID)
      const pending = acquireTextAdvisoryLocks(payload, second.req, [low, high, low])
      await expect(
        waitForAdvisoryLockWaiter(payload, {
          key: low,
          mode: 'ExclusiveLock',
          waiterPID,
        }),
      ).resolves.toMatchObject({ granted: false, pid: waiterPID })

      await payload.db.rollbackTransaction(first.transactionID)
      await pending
      await payload.db.rollbackTransaction(second.transactionID)
    } catch (error) {
      await rollback(first.transactionID, second.transactionID).catch(() => undefined)
      throw error
    }
  })
})
