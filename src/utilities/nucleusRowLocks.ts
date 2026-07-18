import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { APIError, type PayloadRequest } from 'payload'

import { getPostgresTransactionDatabase } from '@/utilities/postgresTransactionLocks'

const uniquePositiveNucleusIDs = (nucleusIDs: Array<number | null>): number[] => {
  const presentIDs = nucleusIDs.filter((id): id is number => id !== null)
  if (presentIDs.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new APIError('Núcleo do bloqueio de escrita inválido.', 500)
  }
  return [...new Set(presentIDs)].sort((left, right) => left - right)
}

export const acquireNucleusRowLocks = async (
  req: PayloadRequest,
  nucleusIDs: Array<number | null>,
): Promise<void> => {
  const sortedIDs = uniquePositiveNucleusIDs(nucleusIDs)
  if (sortedIDs.length === 0) return
  if (req.payload.db.name !== 'postgres') {
    throw new APIError('O bloqueio de escrita do núcleo exige PostgreSQL.', 500)
  }

  let transaction
  try {
    transaction = await getPostgresTransactionDatabase(req.payload, req)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'A transação PostgreSQL não está disponível.'
    ) {
      throw new APIError('A transação de escrita do núcleo não está disponível.', 500)
    }
    if (
      error instanceof Error &&
      error.message === 'A sessão PostgreSQL da transação não está disponível.'
    ) {
      throw new APIError('A sessão de escrita do núcleo não está disponível.', 500)
    }
    throw error
  }

  for (const nucleusID of sortedIDs) {
    await transaction.execute(
      sql`SELECT "id" FROM "electoral_nucleus" WHERE "id" = ${nucleusID} FOR UPDATE`,
    )
  }
}
