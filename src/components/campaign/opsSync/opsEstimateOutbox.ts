'use client'

import { createCollection, localOnlyCollectionOptions, type Transaction } from '@tanstack/db'
import {
  IndexedDBAdapter,
  NonRetriableError,
  startOfflineExecutor,
  type OfflineExecutor,
} from '@tanstack/offline-transactions'

import { estimateVotesCas } from '@/app/(campaign)/campanha/actions/votePledge'
import {
  collapseEstimateOutboxByPledge,
  toOpsEstimateOutboxRow,
  type EnqueueEstimateVotesInput,
  type OpsEstimateOutboxRow,
} from '@/components/campaign/opsSync/opsEstimateOutboxModel'
import {
  applyOpsVotePledgeEstimateWrite,
  patchOpsVotePledgeEstimateOptimistic,
  readOpsVotePledge,
  votePledgesCollection,
} from '@/components/campaign/opsSync/opsVotePledgeMirror'
import { opsOutboxKey, type OpsOutboxKey } from '@/lib/campaignOps/opsContract'
import {
  isOpsEstimateConflictMessage,
  parseOpsEstimateConflictServerEstimatedAt,
} from '@/lib/schemas/votePledge'

const ESTIMATE_MUTATION_FN = 'estimateVotes'

const outboxMutationRow = <TRow>(transaction: Transaction, collectionId: string): TRow => {
  const mutation = transaction.mutations.find((entry) => entry.collection?.id === collectionId)
  if (!mutation) {
    throw new NonRetriableError(`Mutação de outbox ausente (${collectionId}).`)
  }
  return mutation.modified as TRow
}

const opsEstimateOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsEstimateOutboxRow, number>({
    id: 'ops-estimate-outbox',
    getKey: (row) => row.pledgeId,
  }),
)

let executorSingleton: OfflineExecutor | null = null
let initPromise: Promise<OfflineExecutor> | null = null

const ESTIMATE_OUTBOX_DB = 'teqo-ops-estimate'
const ESTIMATE_OUTBOX_STORE = 'outbox'

const createEstimateOfflineExecutor = (): OfflineExecutor =>
  startOfflineExecutor({
    collections: {
      estimateOutbox: opsEstimateOutboxCollection,
      // Mirror rows touched in onMutate must be registered for persistence.
      votePledges: votePledgesCollection,
    },
    storage: new IndexedDBAdapter(ESTIMATE_OUTBOX_DB, ESTIMATE_OUTBOX_STORE),
    beforeRetry: collapseEstimateOutboxByPledge,
    mutationFns: {
      [ESTIMATE_MUTATION_FN]: async ({ transaction }) => {
        const row = outboxMutationRow<OpsEstimateOutboxRow>(transaction, 'ops-estimate-outbox')

        try {
          const updated = await estimateVotesCas({
            pledge: row.pledgeId,
            estimatedVotes: row.estimatedVotes,
            estimateNote: row.estimateNote,
            baseEstimatedAt: row.baseEstimatedAt,
          })
          applyOpsVotePledgeEstimateWrite(updated)
          opsEstimateOutboxCollection.utils.acceptMutations(transaction)
          if (opsEstimateOutboxCollection.has(row.pledgeId)) {
            opsEstimateOutboxCollection.update(row.pledgeId, (draft) => {
              draft.status = 'synced'
            })
            opsEstimateOutboxCollection.delete(row.pledgeId)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsEstimateConflictMessage(message)) {
            const serverEstimatedAt = parseOpsEstimateConflictServerEstimatedAt(message)
            if (opsEstimateOutboxCollection.has(row.pledgeId)) {
              opsEstimateOutboxCollection.update(row.pledgeId, (draft) => {
                draft.status = 'conflict'
                draft.serverEstimatedAt = serverEstimatedAt
                draft.errorMessage = message
              })
            }
            throw new NonRetriableError(message)
          }

          if (opsEstimateOutboxCollection.has(row.pledgeId)) {
            opsEstimateOutboxCollection.update(row.pledgeId, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
    },
  })

export const getOpsEstimateOfflineExecutor = async (): Promise<OfflineExecutor> => {
  if (executorSingleton) {
    await executorSingleton.waitForInit()
    return executorSingleton
  }

  if (!initPromise) {
    initPromise = (async () => {
      const executor = createEstimateOfflineExecutor()
      await executor.waitForInit()
      executorSingleton = executor
      return executor
    })()
  }

  return initPromise
}

export const enqueueEstimateVotes = async (input: EnqueueEstimateVotesInput): Promise<void> => {
  const executor = await getOpsEstimateOfflineExecutor()

  const run = executor.createOfflineAction<EnqueueEstimateVotesInput>({
    mutationFnName: ESTIMATE_MUTATION_FN,
    onMutate: (variables) => {
      const mirrorRow = readOpsVotePledge(variables.pledge)
      const baseEstimatedAt =
        variables.baseEstimatedAt !== undefined
          ? variables.baseEstimatedAt
          : (mirrorRow?.estimatedAt ?? null)
      const next = toOpsEstimateOutboxRow({ ...variables, baseEstimatedAt }, 'pending')
      patchOpsVotePledgeEstimateOptimistic(next.pledgeId, next.estimatedVotes, next.estimateNote)
      if (opsEstimateOutboxCollection.has(next.pledgeId)) {
        opsEstimateOutboxCollection.update(next.pledgeId, (draft) => {
          draft.estimatedVotes = next.estimatedVotes
          draft.estimateNote = next.estimateNote
          draft.baseEstimatedAt = next.baseEstimatedAt
          draft.status = 'pending'
          draft.serverEstimatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        opsEstimateOutboxCollection.insert(next)
      }
    },
  })

  // Fire-and-forget: awaiting isPersisted would hang while offline (retriable
  // failures stay queued). UI follows collection status via subscribeChanges.
  run(input)
}

export const subscribeOpsEstimateOutboxRow = (
  pledgeId: number,
  onStoreChange: () => void,
): (() => void) => {
  let previous = opsEstimateOutboxCollection.get(pledgeId)
  const subscription = opsEstimateOutboxCollection.subscribeChanges(() => {
    const next = opsEstimateOutboxCollection.get(pledgeId)
    if (next === previous) return
    previous = next
    onStoreChange()
  })
  return () => {
    subscription.unsubscribe()
  }
}

export const readOpsEstimateOutboxRow = (pledgeId: number): OpsEstimateOutboxRow | undefined =>
  opsEstimateOutboxCollection.get(pledgeId)

export const discardOpsEstimateOutboxRow = (pledgeId: number): void => {
  if (opsEstimateOutboxCollection.has(pledgeId)) {
    opsEstimateOutboxCollection.delete(pledgeId)
  }
}

/** Pending/conflict pledge ids as merge outbox keys (OH5 — protect local rows). */
export const collectOpsEstimateOutboxKeys = (): Set<OpsOutboxKey> => {
  const keys = new Set<OpsOutboxKey>()
  for (const row of opsEstimateOutboxCollection.toArray) {
    if (row.status === 'pending' || row.status === 'conflict') {
      keys.add(opsOutboxKey('votePledges', row.pledgeId))
    }
  }
  return keys
}

/** Logout wipe — persisted IndexedDB even when the executor singleton was never booted (cold reload). */
export const clearOpsEstimateOutboxForLogout = async (): Promise<void> => {
  try {
    if (executorSingleton) {
      await executorSingleton.clearOutbox()
      executorSingleton.dispose()
    } else {
      await new IndexedDBAdapter(ESTIMATE_OUTBOX_DB, ESTIMATE_OUTBOX_STORE).clear()
    }
  } catch {
    // Best effort — private mode / torn-down storage.
  }
  executorSingleton = null
  initPromise = null
  for (const row of opsEstimateOutboxCollection.toArray) {
    if (opsEstimateOutboxCollection.has(row.pledgeId)) {
      opsEstimateOutboxCollection.delete(row.pledgeId)
    }
  }
}
