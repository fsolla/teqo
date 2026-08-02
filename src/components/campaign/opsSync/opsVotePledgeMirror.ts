'use client'

import { createCollection, localOnlyCollectionOptions } from '@tanstack/db'

import {
  mapVotePledgeWriteToOps,
  type VotePledgeEstimateWriteResult,
} from '@/lib/campaignOps/mapVotePledgeWriteToOps'
import type { OpsVotePledge } from '@/lib/campaignOps/opsContract'
import type { VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'

export const votePledgesCollection = createCollection(
  localOnlyCollectionOptions<OpsVotePledge, number>({
    id: 'ops-vote-pledges',
    getKey: (row) => row.id,
  }),
)

export const readOpsVotePledge = (pledgeId: number): OpsVotePledge | undefined =>
  votePledgesCollection.get(pledgeId)

export const subscribeOpsVotePledge = (
  pledgeId: number,
  onStoreChange: () => void,
): (() => void) => {
  let previous = votePledgesCollection.get(pledgeId)
  const subscription = votePledgesCollection.subscribeChanges(() => {
    const next = votePledgesCollection.get(pledgeId)
    if (next === previous) return
    previous = next
    onStoreChange()
  })
  return () => {
    subscription.unsubscribe()
  }
}

/** Optimistic estimate patch while the outbox row is pending. */
export const patchOpsVotePledgeEstimateOptimistic = (
  pledgeId: number,
  estimatedVotes: VoteEstimateScenarioViewModel,
  estimateNote: string | null,
): void => {
  if (!votePledgesCollection.has(pledgeId)) return
  votePledgesCollection.update(pledgeId, (draft) => {
    draft.estimatedVotes = estimatedVotes
    draft.estimateNote = estimateNote
  })
}

/** Authoritative patch after a successful server write (OH7). */
export const applyOpsVotePledgeEstimateWrite = (doc: VotePledgeEstimateWriteResult): void => {
  const mapped = mapVotePledgeWriteToOps(doc)
  if (votePledgesCollection.has(mapped.id)) {
    votePledgesCollection.update(mapped.id, (draft) => {
      draft.estimatedVotes = mapped.estimatedVotes
      draft.estimateNote = mapped.estimateNote
      draft.estimatedAt = mapped.estimatedAt
      draft.estimatedBy = mapped.estimatedBy
      draft.updatedAt = mapped.updatedAt
    })
    return
  }
  votePledgesCollection.insert(mapped)
}
