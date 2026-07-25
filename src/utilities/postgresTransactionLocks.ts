import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

export type PostgresTransactionDatabase = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}

type TransactionPayload = Pick<Payload, 'db'>
type TransactionRequest = {
  transactionID?: PayloadRequest['transactionID']
}

export const getPostgresTransactionDatabase = async (
  payload: TransactionPayload,
  req: TransactionRequest,
): Promise<PostgresTransactionDatabase> => {
  if (payload.db.name !== 'postgres') {
    throw new Error('O bloqueio transacional exige o adaptador PostgreSQL.')
  }
  const transactionID = await req.transactionID
  if (transactionID === undefined || transactionID === null) {
    throw new Error('A transação PostgreSQL não está disponível.')
  }

  const database = payload.db.sessions?.[String(transactionID)]?.db as
    | PostgresTransactionDatabase
    | undefined
  if (!database || typeof database.execute !== 'function') {
    throw new Error('A sessão PostgreSQL da transação não está disponível.')
  }
  return database
}

export const acquireTextAdvisoryLocks = async (
  payload: TransactionPayload,
  req: TransactionRequest,
  keys: string[],
): Promise<void> => {
  if (keys.some((key) => typeof key !== 'string' || key.trim().length === 0)) {
    throw new Error('A chave do bloqueio PostgreSQL deve ser um texto não vazio.')
  }

  const sortedKeys = [...new Set(keys)].sort()
  if (sortedKeys.length === 0) return

  const database = await getPostgresTransactionDatabase(payload, req)
  // Batch every key into a single round trip: unnest() preserves array order for a
  // plain function scan, and pg_advisory_xact_lock is volatile (never parallelized),
  // so locks are still acquired sequentially in sorted order — same deadlock-avoidance
  // guarantee as the previous per-key loop, at 1 round trip instead of N.
  const keyFragments = sortedKeys.map((key) => sql`${key}`)
  await database.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(k, 0)) FROM unnest(ARRAY[${sql.join(keyFragments, sql`, `)}]::text[]) AS k`,
  )
}
