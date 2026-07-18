import 'server-only'

import { APIError, type PayloadRequest } from 'payload'

import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

const uniquePositiveNucleusIDs = (nucleusIDs: Array<number | null>): number[] => {
  const presentIDs = nucleusIDs.filter((id): id is number => id !== null)
  if (presentIDs.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new APIError('Núcleo do contato principal inválido.', 500)
  }
  return [...new Set(presentIDs)].sort((left, right) => left - right)
}

export const acquirePrimaryContactInvariantLocks = async (
  req: PayloadRequest,
  nucleusIDs: Array<number | null>,
): Promise<void> => {
  const sortedIDs = uniquePositiveNucleusIDs(nucleusIDs)
  if (sortedIDs.length === 0) return
  if (req.payload.db.name !== 'postgres') {
    throw new APIError('O bloqueio do contato principal exige PostgreSQL.', 500)
  }

  try {
    await acquireTextAdvisoryLocks(
      req.payload,
      req,
      sortedIDs.map((nucleusID) => `primary-contact:${nucleusID}`),
    )
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'A transação PostgreSQL não está disponível.'
    ) {
      throw new APIError('A transação do contato principal não está disponível.', 500)
    }
    if (
      error instanceof Error &&
      error.message === 'A sessão PostgreSQL da transação não está disponível.'
    ) {
      throw new APIError('A sessão do contato principal não está disponível.', 500)
    }
    throw error
  }
}
