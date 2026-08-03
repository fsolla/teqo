import 'server-only'

import type { Payload } from 'payload'

export type PayloadTransactionRequest = {
  transactionID: number | string
}

export type PayloadTransactionContext = {
  transactionID: number | string
  req: PayloadTransactionRequest
}

type TransactionPayload = Pick<Payload, 'db'>

export type PayloadTransactionOptions = {
  beginFailureMessage?: string
}

const DEFAULT_BEGIN_FAILURE_MESSAGE = 'Não foi possível iniciar a transação.'

const afterCommitCallbacks = new Map<string, Array<() => void>>()

const transactionKey = (transactionID: number | string): string => String(transactionID)

/**
 * Register a side effect to run only after `withPayloadTransaction` successfully
 * commits. Callbacks are discarded on rollback. Used so notification push (and
 * similar post-write work) cannot observe an uncommitted row or fire after a
 * rollback — `queueMicrotask` runs before `commitTransaction` (Pass 5 P1).
 *
 * Only transactions opened by `withPayloadTransaction` flush this registry.
 * Callers that pass a foreign/Payload-internal `transactionID` should not rely
 * on this hook; prefer creating the side-effect write without that `req`, or
 * open the write through `withPayloadTransaction`.
 */
export const onPayloadTransactionCommit = (
  transactionID: number | string,
  callback: () => void,
): void => {
  const key = transactionKey(transactionID)
  const existing = afterCommitCallbacks.get(key)
  if (existing) {
    existing.push(callback)
    return
  }
  afterCommitCallbacks.set(key, [callback])
}

const discardAfterCommitCallbacks = (transactionID: number | string): void => {
  afterCommitCallbacks.delete(transactionKey(transactionID))
}

const runAfterCommitCallbacks = (transactionID: number | string): void => {
  const key = transactionKey(transactionID)
  const callbacks = afterCommitCallbacks.get(key) ?? []
  afterCommitCallbacks.delete(key)
  for (const callback of callbacks) {
    try {
      callback()
    } catch {
      // After-commit side effects must not fail the write caller.
    }
  }
}

const rollbackOrAggregate = async (
  payload: TransactionPayload,
  transactionID: number | string,
  originalError: unknown,
): Promise<never> => {
  discardAfterCommitCallbacks(transactionID)
  try {
    await payload.db.rollbackTransaction(transactionID)
  } catch (rollbackError) {
    throw new AggregateError(
      [originalError, rollbackError],
      'A operação e o rollback da transação falharam.',
      { cause: originalError },
    )
  }

  throw originalError
}

export const withPayloadTransaction = async <Result>(
  payload: TransactionPayload,
  callback: (context: PayloadTransactionContext) => Promise<Result>,
  options: PayloadTransactionOptions = {},
): Promise<Result> => {
  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null) {
    throw new Error(options.beginFailureMessage ?? DEFAULT_BEGIN_FAILURE_MESSAGE)
  }

  const req: PayloadTransactionRequest = { transactionID }

  let result: Result
  try {
    result = await callback({ transactionID, req })
  } catch (error) {
    return rollbackOrAggregate(payload, transactionID, error)
  }

  try {
    await payload.db.commitTransaction(transactionID)
  } catch (error) {
    return rollbackOrAggregate(payload, transactionID, error)
  }

  runAfterCommitCallbacks(transactionID)
  return result
}
