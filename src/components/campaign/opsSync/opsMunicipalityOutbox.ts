'use client'

import { createCollection, localOnlyCollectionOptions, type Transaction } from '@tanstack/db'
import {
  IndexedDBAdapter,
  NonRetriableError,
  startOfflineExecutor,
  type OfflineExecutor,
} from '@tanstack/offline-transactions'

import {
  assignMunicipalityAdvisorsCas,
  setMunicipalityEngagementLevelCas,
  setMunicipalityPoliticalTrendCas,
} from '@/app/(campaign)/campanha/actions/municipality'
import { createMunicipalityUpdateCas } from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import { declareVotesCas } from '@/app/(campaign)/campanha/actions/votePledge'
import {
  collapseAdvisorsOutbox,
  collapseDeclareVotesOutbox,
  collapseEngagementLevelOutbox,
  collapseMunicipalityUpdateOutbox,
  collapsePoliticalTrendOutbox,
  declareVotesOutboxKey,
  type OpsAdvisorsOutboxRow,
  type OpsDeclareVotesOutboxRow,
  type OpsEngagementLevelOutboxRow,
  type OpsMunicipalityUpdateOutboxRow,
  type OpsPoliticalTrendOutboxRow,
} from '@/components/campaign/opsSync/opsMunicipalityOutboxModel'
import {
  applyOpsVotePledgeEstimateWrite,
  votePledgesCollection,
} from '@/components/campaign/opsSync/opsVotePledgeMirror'
import { opsOutboxKey, type OpsOutboxKey } from '@/lib/campaignOps/opsContract'
import type { EngagementLevel } from '@/lib/engagementLevel'
import type { PoliticalTrendStatusValue } from '@/lib/schemas/municipality'
import type {
  MunicipalitySignalType,
  MunicipalityUpdateKind,
} from '@/lib/schemas/municipalityUpdate'
import {
  isOpsUpdatedAtConflictMessage,
  parseOpsUpdatedAtConflictServerUpdatedAt,
} from '@/lib/schemas/opsCas'

const DECLARE_MUTATION_FN = 'declareVotes'
const MUNICIPALITY_UPDATE_MUTATION_FN = 'createMunicipalityUpdate'
const TREND_MUTATION_FN = 'setPoliticalTrend'
const ENGAGEMENT_MUTATION_FN = 'setEngagementLevel'
const ADVISORS_MUTATION_FN = 'assignAdvisors'

const outboxMutationRow = <TRow>(transaction: Transaction, collectionId: string): TRow => {
  const mutation = transaction.mutations.find((entry) => entry.collection?.id === collectionId)
  if (!mutation) {
    throw new NonRetriableError(`Mutação de outbox ausente (${collectionId}).`)
  }
  return mutation.modified as TRow
}

const declareVotesOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsDeclareVotesOutboxRow, string>({
    id: 'ops-declare-votes-outbox',
    getKey: (row) => row.id,
  }),
)

const municipalityUpdateOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsMunicipalityUpdateOutboxRow, string>({
    id: 'ops-municipality-update-outbox',
    getKey: (row) => row.id,
  }),
)

const politicalTrendOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsPoliticalTrendOutboxRow, number>({
    id: 'ops-political-trend-outbox',
    getKey: (row) => row.municipalityId,
  }),
)

const engagementLevelOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsEngagementLevelOutboxRow, number>({
    id: 'ops-engagement-level-outbox',
    getKey: (row) => row.municipalityId,
  }),
)

const advisorsOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsAdvisorsOutboxRow, number>({
    id: 'ops-advisors-outbox',
    getKey: (row) => row.municipalityId,
  }),
)

let executorSingleton: OfflineExecutor | null = null
let initPromise: Promise<OfflineExecutor> | null = null

const collapseAllMunicipalityOutbox = (
  transactions: Parameters<typeof collapseDeclareVotesOutbox>[0],
) => {
  const byFn = new Map<string, typeof transactions>()
  for (const transaction of transactions) {
    const fn = transaction.mutationFnName ?? ''
    const list = byFn.get(fn) ?? []
    list.push(transaction)
    byFn.set(fn, list)
  }

  const collapsed = [
    ...(byFn.get(DECLARE_MUTATION_FN)
      ? collapseDeclareVotesOutbox(byFn.get(DECLARE_MUTATION_FN)!)
      : []),
    ...(byFn.get(MUNICIPALITY_UPDATE_MUTATION_FN)
      ? collapseMunicipalityUpdateOutbox(byFn.get(MUNICIPALITY_UPDATE_MUTATION_FN)!)
      : []),
    ...(byFn.get(TREND_MUTATION_FN)
      ? collapsePoliticalTrendOutbox(byFn.get(TREND_MUTATION_FN)!)
      : []),
    ...(byFn.get(ENGAGEMENT_MUTATION_FN)
      ? collapseEngagementLevelOutbox(byFn.get(ENGAGEMENT_MUTATION_FN)!)
      : []),
    ...(byFn.get(ADVISORS_MUTATION_FN)
      ? collapseAdvisorsOutbox(byFn.get(ADVISORS_MUTATION_FN)!)
      : []),
  ]

  for (const [fn, list] of byFn) {
    if (
      fn !== DECLARE_MUTATION_FN &&
      fn !== MUNICIPALITY_UPDATE_MUTATION_FN &&
      fn !== TREND_MUTATION_FN &&
      fn !== ENGAGEMENT_MUTATION_FN &&
      fn !== ADVISORS_MUTATION_FN
    ) {
      collapsed.push(...list)
    }
  }

  return collapsed.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
}

const handleUpdatedAtConflict = (
  message: string,
  onConflict: (serverUpdatedAt: string | null) => void,
): never => {
  onConflict(parseOpsUpdatedAtConflictServerUpdatedAt(message))
  throw new NonRetriableError(message)
}

const MUNICIPALITY_OUTBOX_DB = 'teqo-ops-municipality'
const MUNICIPALITY_OUTBOX_STORE = 'outbox'

const createMunicipalityOfflineExecutor = (): OfflineExecutor =>
  startOfflineExecutor({
    collections: {
      declareVotesOutbox: declareVotesOutboxCollection,
      municipalityUpdateOutbox: municipalityUpdateOutboxCollection,
      politicalTrendOutbox: politicalTrendOutboxCollection,
      engagementLevelOutbox: engagementLevelOutboxCollection,
      advisorsOutbox: advisorsOutboxCollection,
      // Mirror rows touched in onMutate must be registered for persistence.
      votePledges: votePledgesCollection,
    },
    storage: new IndexedDBAdapter(MUNICIPALITY_OUTBOX_DB, MUNICIPALITY_OUTBOX_STORE),
    beforeRetry: collapseAllMunicipalityOutbox,
    mutationFns: {
      [DECLARE_MUTATION_FN]: async ({ transaction }) => {
        const row = outboxMutationRow<OpsDeclareVotesOutboxRow>(
          transaction,
          'ops-declare-votes-outbox',
        )
        try {
          const updated = await declareVotesCas({
            municipality: row.municipalityId,
            leadership: row.leadershipId,
            declaredVotes: row.declaredVotes,
            baseUpdatedAt: row.baseUpdatedAt,
          })
          applyOpsVotePledgeEstimateWrite(updated)
          declareVotesOutboxCollection.utils.acceptMutations(transaction)
          if (declareVotesOutboxCollection.has(row.id)) {
            declareVotesOutboxCollection.delete(row.id)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsUpdatedAtConflictMessage(message)) {
            handleUpdatedAtConflict(message, (serverUpdatedAt) => {
              if (declareVotesOutboxCollection.has(row.id)) {
                declareVotesOutboxCollection.update(row.id, (draft) => {
                  draft.status = 'conflict'
                  draft.serverUpdatedAt = serverUpdatedAt
                  draft.errorMessage = message
                })
              }
            })
          }
          if (declareVotesOutboxCollection.has(row.id)) {
            declareVotesOutboxCollection.update(row.id, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
      [MUNICIPALITY_UPDATE_MUTATION_FN]: async ({ transaction }) => {
        const row = outboxMutationRow<OpsMunicipalityUpdateOutboxRow>(
          transaction,
          'ops-municipality-update-outbox',
        )
        try {
          await createMunicipalityUpdateCas({
            municipality: row.municipalityId,
            kind: row.kind,
            worked: row.worked,
            failed: row.failed,
            needs: row.needs,
            body: row.body,
            activeVolunteers: row.activeVolunteers,
            newSupports: row.newSupports,
            signalType: row.signalType,
            baseUpdatedAt: row.baseUpdatedAt,
          })
          municipalityUpdateOutboxCollection.utils.acceptMutations(transaction)
          if (municipalityUpdateOutboxCollection.has(row.id)) {
            municipalityUpdateOutboxCollection.delete(row.id)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsUpdatedAtConflictMessage(message)) {
            handleUpdatedAtConflict(message, (serverUpdatedAt) => {
              if (municipalityUpdateOutboxCollection.has(row.id)) {
                municipalityUpdateOutboxCollection.update(row.id, (draft) => {
                  draft.status = 'conflict'
                  draft.serverUpdatedAt = serverUpdatedAt
                  draft.errorMessage = message
                })
              }
            })
          }
          if (municipalityUpdateOutboxCollection.has(row.id)) {
            municipalityUpdateOutboxCollection.update(row.id, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
      [TREND_MUTATION_FN]: async ({ transaction }) => {
        const row = outboxMutationRow<OpsPoliticalTrendOutboxRow>(
          transaction,
          'ops-political-trend-outbox',
        )
        try {
          await setMunicipalityPoliticalTrendCas({
            municipality: row.municipalityId,
            status: row.status,
            note: row.note,
            baseUpdatedAt: row.baseUpdatedAt,
          })
          politicalTrendOutboxCollection.utils.acceptMutations(transaction)
          if (politicalTrendOutboxCollection.has(row.municipalityId)) {
            politicalTrendOutboxCollection.delete(row.municipalityId)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsUpdatedAtConflictMessage(message)) {
            handleUpdatedAtConflict(message, (serverUpdatedAt) => {
              if (politicalTrendOutboxCollection.has(row.municipalityId)) {
                politicalTrendOutboxCollection.update(row.municipalityId, (draft) => {
                  draft.statusSync = 'conflict'
                  draft.serverUpdatedAt = serverUpdatedAt
                  draft.errorMessage = message
                })
              }
            })
          }
          if (politicalTrendOutboxCollection.has(row.municipalityId)) {
            politicalTrendOutboxCollection.update(row.municipalityId, (draft) => {
              draft.statusSync = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
      [ENGAGEMENT_MUTATION_FN]: async ({ transaction }) => {
        const row = outboxMutationRow<OpsEngagementLevelOutboxRow>(
          transaction,
          'ops-engagement-level-outbox',
        )
        try {
          await setMunicipalityEngagementLevelCas({
            municipality: row.municipalityId,
            level: row.level,
            note: row.note,
            reversalSignals: row.reversalSignals,
            triangulatedShock: row.triangulatedShock,
            override: row.override,
            baseUpdatedAt: row.baseUpdatedAt,
          })
          engagementLevelOutboxCollection.utils.acceptMutations(transaction)
          if (engagementLevelOutboxCollection.has(row.municipalityId)) {
            engagementLevelOutboxCollection.delete(row.municipalityId)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsUpdatedAtConflictMessage(message)) {
            handleUpdatedAtConflict(message, (serverUpdatedAt) => {
              if (engagementLevelOutboxCollection.has(row.municipalityId)) {
                engagementLevelOutboxCollection.update(row.municipalityId, (draft) => {
                  draft.status = 'conflict'
                  draft.serverUpdatedAt = serverUpdatedAt
                  draft.errorMessage = message
                })
              }
            })
          }
          if (engagementLevelOutboxCollection.has(row.municipalityId)) {
            engagementLevelOutboxCollection.update(row.municipalityId, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
      [ADVISORS_MUTATION_FN]: async ({ transaction }) => {
        const row = outboxMutationRow<OpsAdvisorsOutboxRow>(transaction, 'ops-advisors-outbox')
        try {
          await assignMunicipalityAdvisorsCas({
            municipality: row.municipalityId,
            advisors: row.advisors,
            baseUpdatedAt: row.baseUpdatedAt,
          })
          advisorsOutboxCollection.utils.acceptMutations(transaction)
          if (advisorsOutboxCollection.has(row.municipalityId)) {
            advisorsOutboxCollection.delete(row.municipalityId)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsUpdatedAtConflictMessage(message)) {
            handleUpdatedAtConflict(message, (serverUpdatedAt) => {
              if (advisorsOutboxCollection.has(row.municipalityId)) {
                advisorsOutboxCollection.update(row.municipalityId, (draft) => {
                  draft.status = 'conflict'
                  draft.serverUpdatedAt = serverUpdatedAt
                  draft.errorMessage = message
                })
              }
            })
          }
          if (advisorsOutboxCollection.has(row.municipalityId)) {
            advisorsOutboxCollection.update(row.municipalityId, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
    },
  })

export const getOpsMunicipalityOfflineExecutor = async (): Promise<OfflineExecutor> => {
  if (executorSingleton) {
    await executorSingleton.waitForInit()
    return executorSingleton
  }
  if (!initPromise) {
    initPromise = (async () => {
      const executor = createMunicipalityOfflineExecutor()
      await executor.waitForInit()
      executorSingleton = executor
      return executor
    })()
  }
  return initPromise
}

export const enqueueDeclareVotes = async (input: {
  municipalityId: number
  leadershipId: number
  declaredVotes: number
  pledgeId?: number
  baseUpdatedAt?: string | null
}): Promise<void> => {
  const executor = await getOpsMunicipalityOfflineExecutor()
  const id = declareVotesOutboxKey(input.leadershipId, input.municipalityId)
  const mirrorPledge =
    input.pledgeId !== undefined
      ? votePledgesCollection.get(input.pledgeId)
      : votePledgesCollection.toArray.find(
          (row) =>
            row.leadership === input.leadershipId && row.municipality === input.municipalityId,
        )
  const pledgeId = input.pledgeId ?? mirrorPledge?.id
  const baseUpdatedAt =
    input.baseUpdatedAt !== undefined ? input.baseUpdatedAt : (mirrorPledge?.updatedAt ?? null)

  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: DECLARE_MUTATION_FN,
    onMutate: (variables) => {
      const next: OpsDeclareVotesOutboxRow = {
        id,
        municipalityId: variables.municipalityId,
        leadershipId: variables.leadershipId,
        pledgeId,
        declaredVotes: variables.declaredVotes,
        baseUpdatedAt: variables.baseUpdatedAt ?? baseUpdatedAt,
        status: 'pending',
      }
      if (pledgeId !== undefined && votePledgesCollection.has(pledgeId)) {
        votePledgesCollection.update(pledgeId, (draft) => {
          draft.declaredVotes = variables.declaredVotes
        })
      }
      if (declareVotesOutboxCollection.has(id)) {
        declareVotesOutboxCollection.update(id, (draft) => {
          draft.declaredVotes = next.declaredVotes
          draft.pledgeId = next.pledgeId
          draft.baseUpdatedAt = next.baseUpdatedAt
          draft.status = 'pending'
          draft.serverUpdatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        declareVotesOutboxCollection.insert(next)
      }
    },
  })
  run({ ...input, baseUpdatedAt, pledgeId })
}

export const enqueueMunicipalityUpdate = async (input: {
  clientId: string
  municipalityId: number
  kind: MunicipalityUpdateKind
  worked?: string
  failed?: string
  needs?: string
  body?: string
  activeVolunteers?: number
  newSupports?: number
  signalType?: MunicipalitySignalType
  baseUpdatedAt?: string | null
}): Promise<void> => {
  const executor = await getOpsMunicipalityOfflineExecutor()
  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: MUNICIPALITY_UPDATE_MUTATION_FN,
    onMutate: (variables) => {
      const next: OpsMunicipalityUpdateOutboxRow = {
        id: variables.clientId,
        municipalityId: variables.municipalityId,
        kind: variables.kind,
        worked: variables.worked,
        failed: variables.failed,
        needs: variables.needs,
        body: variables.body,
        activeVolunteers: variables.activeVolunteers,
        newSupports: variables.newSupports,
        signalType: variables.signalType,
        baseUpdatedAt: variables.baseUpdatedAt,
        status: 'pending',
      }
      if (municipalityUpdateOutboxCollection.has(next.id)) {
        municipalityUpdateOutboxCollection.update(next.id, (draft) => {
          Object.assign(draft, next)
        })
      } else {
        municipalityUpdateOutboxCollection.insert(next)
      }
    },
  })
  run(input)
}

export const enqueuePoliticalTrend = async (input: {
  municipalityId: number
  status: PoliticalTrendStatusValue | null
  note: string | null
  baseUpdatedAt?: string | null
}): Promise<void> => {
  const executor = await getOpsMunicipalityOfflineExecutor()
  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: TREND_MUTATION_FN,
    onMutate: (variables) => {
      const next: OpsPoliticalTrendOutboxRow = {
        municipalityId: variables.municipalityId,
        status: variables.status,
        note: variables.note,
        baseUpdatedAt: variables.baseUpdatedAt,
        statusSync: 'pending',
      }
      if (politicalTrendOutboxCollection.has(variables.municipalityId)) {
        politicalTrendOutboxCollection.update(variables.municipalityId, (draft) => {
          draft.status = next.status
          draft.note = next.note
          draft.baseUpdatedAt = next.baseUpdatedAt
          draft.statusSync = 'pending'
          draft.serverUpdatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        politicalTrendOutboxCollection.insert(next)
      }
    },
  })
  run(input)
}

export const enqueueEngagementLevel = async (input: {
  municipalityId: number
  level: EngagementLevel
  note: string
  reversalSignals: string
  triangulatedShock: boolean
  override: boolean
  baseUpdatedAt?: string | null
}): Promise<void> => {
  const executor = await getOpsMunicipalityOfflineExecutor()
  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: ENGAGEMENT_MUTATION_FN,
    onMutate: (variables) => {
      const next: OpsEngagementLevelOutboxRow = {
        municipalityId: variables.municipalityId,
        level: variables.level,
        note: variables.note,
        reversalSignals: variables.reversalSignals,
        triangulatedShock: variables.triangulatedShock,
        override: variables.override,
        baseUpdatedAt: variables.baseUpdatedAt,
        status: 'pending',
      }
      if (engagementLevelOutboxCollection.has(variables.municipalityId)) {
        engagementLevelOutboxCollection.update(variables.municipalityId, (draft) => {
          Object.assign(draft, next)
          draft.serverUpdatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        engagementLevelOutboxCollection.insert(next)
      }
    },
  })
  run(input)
}

export const enqueueAdvisorsAssignment = async (input: {
  municipalityId: number
  advisors: number[]
  baseUpdatedAt?: string | null
}): Promise<void> => {
  const executor = await getOpsMunicipalityOfflineExecutor()
  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: ADVISORS_MUTATION_FN,
    onMutate: (variables) => {
      const next: OpsAdvisorsOutboxRow = {
        municipalityId: variables.municipalityId,
        advisors: variables.advisors,
        baseUpdatedAt: variables.baseUpdatedAt,
        status: 'pending',
      }
      if (advisorsOutboxCollection.has(variables.municipalityId)) {
        advisorsOutboxCollection.update(variables.municipalityId, (draft) => {
          draft.advisors = next.advisors
          draft.baseUpdatedAt = next.baseUpdatedAt
          draft.status = 'pending'
          draft.serverUpdatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        advisorsOutboxCollection.insert(next)
      }
    },
  })
  run(input)
}

export const collectOpsMunicipalityOutboxKeys = (): Set<OpsOutboxKey> => {
  const keys = new Set<OpsOutboxKey>()
  for (const row of declareVotesOutboxCollection.toArray) {
    if (row.status === 'pending' || row.status === 'conflict') {
      if (row.pledgeId !== undefined) {
        keys.add(opsOutboxKey('votePledges', row.pledgeId))
      } else {
        const pledge = votePledgesCollection.toArray.find(
          (p) => p.leadership === row.leadershipId && p.municipality === row.municipalityId,
        )
        if (pledge) keys.add(opsOutboxKey('votePledges', pledge.id))
      }
    }
  }
  for (const row of municipalityUpdateOutboxCollection.toArray) {
    if (row.status === 'pending' || row.status === 'conflict') {
      keys.add(opsOutboxKey('municipalities', row.municipalityId))
    }
  }
  for (const row of politicalTrendOutboxCollection.toArray) {
    if (row.statusSync === 'pending' || row.statusSync === 'conflict') {
      keys.add(opsOutboxKey('municipalities', row.municipalityId))
    }
  }
  for (const row of engagementLevelOutboxCollection.toArray) {
    if (row.status === 'pending' || row.status === 'conflict') {
      keys.add(opsOutboxKey('municipalities', row.municipalityId))
    }
  }
  for (const row of advisorsOutboxCollection.toArray) {
    if (row.status === 'pending' || row.status === 'conflict') {
      keys.add(opsOutboxKey('municipalities', row.municipalityId))
    }
  }
  return keys
}

export const readOpsDeclareVotesOutboxRow = (
  leadershipId: number,
  municipalityId: number,
): OpsDeclareVotesOutboxRow | undefined =>
  declareVotesOutboxCollection.get(declareVotesOutboxKey(leadershipId, municipalityId))

export const subscribeOpsDeclareVotesOutboxRow = (
  leadershipId: number,
  municipalityId: number,
  onStoreChange: () => void,
): (() => void) => {
  const id = declareVotesOutboxKey(leadershipId, municipalityId)
  let previous = declareVotesOutboxCollection.get(id)
  const subscription = declareVotesOutboxCollection.subscribeChanges(() => {
    const next = declareVotesOutboxCollection.get(id)
    if (next === previous) return
    previous = next
    onStoreChange()
  })
  return () => subscription.unsubscribe()
}

export const discardOpsDeclareVotesOutboxRow = (
  leadershipId: number,
  municipalityId: number,
): void => {
  const id = declareVotesOutboxKey(leadershipId, municipalityId)
  if (declareVotesOutboxCollection.has(id)) declareVotesOutboxCollection.delete(id)
}

export const readOpsAdvisorsOutboxRow = (
  municipalityId: number,
): OpsAdvisorsOutboxRow | undefined => advisorsOutboxCollection.get(municipalityId)

export const subscribeOpsAdvisorsOutboxRow = (
  municipalityId: number,
  onStoreChange: () => void,
): (() => void) => {
  let previous = advisorsOutboxCollection.get(municipalityId)
  const subscription = advisorsOutboxCollection.subscribeChanges(() => {
    const next = advisorsOutboxCollection.get(municipalityId)
    if (next === previous) return
    previous = next
    onStoreChange()
  })
  return () => subscription.unsubscribe()
}

export const discardOpsAdvisorsOutboxRow = (municipalityId: number): void => {
  if (advisorsOutboxCollection.has(municipalityId)) {
    advisorsOutboxCollection.delete(municipalityId)
  }
}

const wipeMunicipalityOutboxCollections = (): void => {
  for (const row of declareVotesOutboxCollection.toArray) {
    if (declareVotesOutboxCollection.has(row.id)) {
      declareVotesOutboxCollection.delete(row.id)
    }
  }
  for (const row of municipalityUpdateOutboxCollection.toArray) {
    if (municipalityUpdateOutboxCollection.has(row.id)) {
      municipalityUpdateOutboxCollection.delete(row.id)
    }
  }
  for (const row of politicalTrendOutboxCollection.toArray) {
    if (politicalTrendOutboxCollection.has(row.municipalityId)) {
      politicalTrendOutboxCollection.delete(row.municipalityId)
    }
  }
  for (const row of engagementLevelOutboxCollection.toArray) {
    if (engagementLevelOutboxCollection.has(row.municipalityId)) {
      engagementLevelOutboxCollection.delete(row.municipalityId)
    }
  }
  for (const row of advisorsOutboxCollection.toArray) {
    if (advisorsOutboxCollection.has(row.municipalityId)) {
      advisorsOutboxCollection.delete(row.municipalityId)
    }
  }
}

/** Logout wipe — persisted IndexedDB even when the executor singleton was never booted (cold reload). */
export const clearOpsMunicipalityOutboxForLogout = async (): Promise<void> => {
  try {
    if (executorSingleton) {
      await executorSingleton.clearOutbox()
      executorSingleton.dispose()
    } else {
      await new IndexedDBAdapter(MUNICIPALITY_OUTBOX_DB, MUNICIPALITY_OUTBOX_STORE).clear()
    }
  } catch {
    // Best effort — private mode / torn-down storage.
  }
  executorSingleton = null
  initPromise = null
  wipeMunicipalityOutboxCollections()
}
