'use client'

import { createCollection, localOnlyCollectionOptions } from '@tanstack/db'
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
  isOpsEstimateConflictMessage,
  parseOpsEstimateConflictServerEstimatedAt,
} from '@/lib/schemas/votePledge'

const ESTIMATE_MUTATION_FN = 'estimateVotes'

export const opsEstimateOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsEstimateOutboxRow, number>({
    id: 'ops-estimate-outbox',
    getKey: (row) => row.pledgeId,
  }),
)

let executorSingleton: OfflineExecutor | null = null
let initPromise: Promise<OfflineExecutor> | null = null

const createEstimateOfflineExecutor = (): OfflineExecutor =>
  startOfflineExecutor({
    collections: { estimateOutbox: opsEstimateOutboxCollection },
    storage: new IndexedDBAdapter('teqo-ops-estimate', 'outbox'),
    beforeRetry: collapseEstimateOutboxByPledge,
    mutationFns: {
      [ESTIMATE_MUTATION_FN]: async ({ transaction }) => {
        const mutation = transaction.mutations[0]
        if (!mutation) {
          throw new NonRetriableError('Mutação de estimativa vazia.')
        }

        const row = mutation.modified as OpsEstimateOutboxRow

        try {
          await estimateVotesCas({
            pledge: row.pledgeId,
            estimatedVotes: row.estimatedVotes,
            estimateNote: row.estimateNote,
            baseEstimatedAt: row.baseEstimatedAt,
          })
          opsEstimateOutboxCollection.utils.acceptMutations(transaction)
          if (opsEstimateOutboxCollection.has(row.pledgeId)) {
            opsEstimateOutboxCollection.update(row.pledgeId, (draft) => {
              draft.status = 'synced'
              draft.serverEstimatedAt = undefined
              draft.errorMessage = undefined
            })
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

export const enqueueEstimateVotes = async (
  input: EnqueueEstimateVotesInput,
): Promise<void> => {
  const executor = await getOpsEstimateOfflineExecutor()

  const run = executor.createOfflineAction<EnqueueEstimateVotesInput>({
    mutationFnName: ESTIMATE_MUTATION_FN,
    onMutate: (variables) => {
      const next = toOpsEstimateOutboxRow(variables, 'pending')
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
  _pledgeId: number,
  onStoreChange: () => void,
): (() => void) => {
  const subscription = opsEstimateOutboxCollection.subscribeChanges(() => {
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
