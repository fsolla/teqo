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

const rollbackOrAggregate = async (
  payload: TransactionPayload,
  transactionID: number | string,
  originalError: unknown,
): Promise<never> => {
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

  return result
}
