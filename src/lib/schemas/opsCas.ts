import { z } from 'zod'

/**
 * OH10 — shared CAS token for doc `updatedAt`. Opt-in: absent → last-write-wins
 * (legacy). Present (including matching the current stamp) → refuse when the
 * row's `updatedAt` differs. Same exact-string + optional stamp contract as
 * OH6's `OPS_ESTIMATE_CONFLICT_MESSAGE` (safeMessages + outbox parse).
 */
export const optionalBaseUpdatedAtSchema = z.string().datetime().nullable().optional()

export const OPS_UPDATED_AT_CONFLICT_MESSAGE =
  'Este registro foi alterado por outra pessoa. Escolha manter a sua ou usar a nova.'

export const opsUpdatedAtConflictError = (serverUpdatedAt: string): Error =>
  new Error(`${OPS_UPDATED_AT_CONFLICT_MESSAGE}\n${serverUpdatedAt}`)

export const isOpsUpdatedAtConflictMessage = (message: string): boolean =>
  message === OPS_UPDATED_AT_CONFLICT_MESSAGE ||
  message.startsWith(`${OPS_UPDATED_AT_CONFLICT_MESSAGE}\n`)

export const parseOpsUpdatedAtConflictServerUpdatedAt = (message: string): string | null => {
  if (!isOpsUpdatedAtConflictMessage(message)) return null
  if (message === OPS_UPDATED_AT_CONFLICT_MESSAGE) return null
  const stamped = message.slice(OPS_UPDATED_AT_CONFLICT_MESSAGE.length + 1)
  return stamped === '' ? null : stamped
}

/** Refuse when CAS is armed and the live stamp differs from the client's base. */
export const assertOpsUpdatedAtCas = (
  enforceCas: boolean,
  baseUpdatedAt: string | null | undefined,
  currentUpdatedAt: string,
): void => {
  if (!enforceCas || baseUpdatedAt === undefined) return
  if (currentUpdatedAt !== baseUpdatedAt) {
    throw opsUpdatedAtConflictError(currentUpdatedAt)
  }
}
