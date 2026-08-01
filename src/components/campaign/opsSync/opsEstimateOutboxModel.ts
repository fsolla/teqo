import type { OfflineTransaction } from '@tanstack/offline-transactions'

import type { VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'

export type OpsEstimateSyncStatus = 'pending' | 'synced' | 'conflict' | 'error'

export type OpsEstimateOutboxRow = {
  pledgeId: number
  estimatedVotes: VoteEstimateScenarioViewModel
  estimateNote: string | null
  /** CAS token; `undefined` means last-write-wins for this enqueue. */
  baseEstimatedAt?: string | null
  status: OpsEstimateSyncStatus
  serverEstimatedAt?: string | null
  errorMessage?: string
}

export type EnqueueEstimateVotesInput = {
  pledge: number
  estimatedVotes: VoteEstimateScenarioViewModel
  estimateNote: string | null
  baseEstimatedAt?: string | null
}

/**
 * Keep only the newest transaction per pledge key so retries don't replay
 * superseded edits after a flaky reconnect.
 */
export const collapseEstimateOutboxByPledge = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => {
  const latestByPledge = new Map<string, OfflineTransaction>()

  for (const transaction of transactions) {
    const pledgeKey = resolveEstimateTransactionPledgeKey(transaction)
    const current = latestByPledge.get(pledgeKey)
    if (!current || transaction.createdAt.getTime() >= current.createdAt.getTime()) {
      latestByPledge.set(pledgeKey, transaction)
    }
  }

  return [...latestByPledge.values()].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  )
}

export const resolveEstimateTransactionPledgeKey = (transaction: OfflineTransaction): string => {
  const fromMetadata = transaction.metadata?.pledgeId
  if (typeof fromMetadata === 'number' || typeof fromMetadata === 'string') {
    return String(fromMetadata)
  }

  const mutationKey = transaction.mutations[0]?.key
  if (mutationKey != null) return String(mutationKey)

  return transaction.id
}

export const toOpsEstimateOutboxRow = (
  input: EnqueueEstimateVotesInput,
  status: OpsEstimateSyncStatus = 'pending',
): OpsEstimateOutboxRow => ({
  pledgeId: input.pledge,
  estimatedVotes: input.estimatedVotes,
  estimateNote: input.estimateNote,
  baseEstimatedAt: input.baseEstimatedAt,
  status,
})
