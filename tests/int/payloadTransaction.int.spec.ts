// @vitest-environment node

import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { onPayloadTransactionCommit, withPayloadTransaction } from '@/utilities/payloadTransaction'

import { stub } from '../helpers/stub'

type DatabaseSession = NonNullable<Payload['db']['sessions']>[string]

const createPayload = ({
  transactionID = 17,
  commitError,
  rollbackError,
  hasSession = true,
}: {
  transactionID?: number | string | null
  commitError?: Error
  rollbackError?: Error
  hasSession?: boolean
} = {}) => {
  const database = { execute: vi.fn() }
  const beginTransaction = vi.fn().mockResolvedValue(transactionID)
  const commitTransaction = vi.fn().mockImplementation(async () => {
    if (commitError) throw commitError
  })
  const rollbackTransaction = vi.fn().mockImplementation(async () => {
    if (rollbackError) throw rollbackError
  })

  return {
    database,
    payload: {
      db: stub<Payload['db']>({
        beginTransaction,
        commitTransaction,
        rollbackTransaction,
        sessions:
          transactionID === null || !hasSession
            ? {}
            : { [String(transactionID)]: stub<DatabaseSession>({ db: database }) },
      }),
    },
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
  }
}

describe('withPayloadTransaction', () => {
  it('commits a successful callback and propagates one req object and session database', async () => {
    const fixture = createPayload()
    const callback = vi.fn(async ({ req }) => {
      expect(req).toEqual({ transactionID: 17 })
      return { req }
    })

    const result = await withPayloadTransaction(fixture.payload, callback)

    expect(result.req).toBe(callback.mock.calls[0]![0].req)
    expect(fixture.commitTransaction).toHaveBeenCalledWith(17)
    expect(fixture.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('does not run the callback when Payload cannot start a transaction', async () => {
    const fixture = createPayload({ transactionID: null })
    const callback = vi.fn()

    await expect(
      withPayloadTransaction(fixture.payload, callback, {
        beginFailureMessage: 'falha específica',
      }),
    ).rejects.toThrow('falha específica')

    expect(callback).not.toHaveBeenCalled()
    expect(fixture.commitTransaction).not.toHaveBeenCalled()
    expect(fixture.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('rolls back and preserves a callback failure', async () => {
    const fixture = createPayload()
    const original = new Error('callback falhou')

    await expect(
      withPayloadTransaction(fixture.payload, async () => {
        throw original
      }),
    ).rejects.toBe(original)

    expect(fixture.rollbackTransaction).toHaveBeenCalledWith(17)
    expect(fixture.commitTransaction).not.toHaveBeenCalled()
  })

  it('rolls back and preserves a commit failure', async () => {
    const original = new Error('commit falhou')
    const fixture = createPayload({ commitError: original })

    await expect(withPayloadTransaction(fixture.payload, async () => 'result')).rejects.toBe(
      original,
    )

    expect(fixture.commitTransaction).toHaveBeenCalledWith(17)
    expect(fixture.rollbackTransaction).toHaveBeenCalledWith(17)
  })

  it('aggregates rollback failure after callback failure with the original as cause', async () => {
    const original = new Error('callback falhou')
    const rollback = new Error('rollback falhou')
    const fixture = createPayload({ rollbackError: rollback })

    const failure = await withPayloadTransaction(fixture.payload, async () => {
      throw original
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([original, rollback])
    expect((failure as AggregateError & { cause?: unknown }).cause).toBe(original)
  })

  it('aggregates rollback failure after commit failure with the commit error first', async () => {
    const commit = new Error('commit falhou')
    const rollback = new Error('rollback falhou')
    const fixture = createPayload({ commitError: commit, rollbackError: rollback })

    const failure = await withPayloadTransaction(fixture.payload, async () => 'result').catch(
      (error: unknown) => error,
    )

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([commit, rollback])
    expect((failure as AggregateError & { cause?: unknown }).cause).toBe(commit)
  })

  it('runs onPayloadTransactionCommit callbacks only after a successful commit', async () => {
    const fixture = createPayload()
    const afterCommit = vi.fn()

    await withPayloadTransaction(fixture.payload, async ({ transactionID }) => {
      onPayloadTransactionCommit(transactionID, afterCommit)
      expect(afterCommit).not.toHaveBeenCalled()
      return 'ok'
    })

    expect(fixture.commitTransaction).toHaveBeenCalledWith(17)
    expect(afterCommit).toHaveBeenCalledTimes(1)
  })

  it('discards onPayloadTransactionCommit callbacks when the callback fails', async () => {
    const fixture = createPayload()
    const afterCommit = vi.fn()

    await expect(
      withPayloadTransaction(fixture.payload, async ({ transactionID }) => {
        onPayloadTransactionCommit(transactionID, afterCommit)
        throw new Error('callback falhou')
      }),
    ).rejects.toThrow('callback falhou')

    expect(fixture.rollbackTransaction).toHaveBeenCalledWith(17)
    expect(afterCommit).not.toHaveBeenCalled()
  })

  it('discards onPayloadTransactionCommit callbacks when commit fails', async () => {
    const fixture = createPayload({ commitError: new Error('commit falhou') })
    const afterCommit = vi.fn()

    await expect(
      withPayloadTransaction(fixture.payload, async ({ transactionID }) => {
        onPayloadTransactionCommit(transactionID, afterCommit)
        return 'ok'
      }),
    ).rejects.toThrow('commit falhou')

    expect(afterCommit).not.toHaveBeenCalled()
  })

  it('swallows after-commit callback errors so the write caller still receives the result', async () => {
    const fixture = createPayload()

    const result = await withPayloadTransaction(fixture.payload, async ({ transactionID }) => {
      onPayloadTransactionCommit(transactionID, () => {
        throw new Error('push side-effect failed')
      })
      return 'ok'
    })

    expect(result).toBe('ok')
  })
})
