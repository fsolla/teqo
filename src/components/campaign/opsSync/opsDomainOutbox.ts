'use client'

import { createCollection, localOnlyCollectionOptions } from '@tanstack/db'
import {
  IndexedDBAdapter,
  NonRetriableError,
  startOfflineExecutor,
  type OfflineExecutor,
} from '@tanstack/offline-transactions'

import {
  createActivityCas,
  updateActivityCas,
} from '@/app/(campaign)/campanha/actions/activity'
import { transitionCampaignDemandCas } from '@/app/(campaign)/campanha/actions/demand'
import {
  createLeadershipCas,
  setLeadershipMunicipalitiesMembershipCas,
  setLeadershipStateDeputyMembershipCas,
  updateLeadershipInternalCas,
} from '@/app/(campaign)/campanha/actions/leadership'
import { setStateDeputyMunicipalitiesBatchCas } from '@/app/(campaign)/campanha/actions/stateDeputy'
import {
  collapseActivityCreateOutbox,
  collapseActivityUpdateOutbox,
  collapseDemandTransitionOutbox,
  collapseLeadershipCreateOutbox,
  collapseLeadershipMembershipOutbox,
  collapseLeadershipUpdateOutbox,
  collapseStateDeputyMunicipalitiesOutbox,
  leadershipMembershipOutboxKey,
  stateDeputyMunicipalitiesOutboxKey,
  type OpsActivityCreateOutboxRow,
  type OpsActivityUpdateOutboxRow,
  type OpsDemandTransitionOutboxRow,
  type OpsLeadershipCreateOutboxRow,
  type OpsLeadershipMembershipOutboxRow,
  type OpsLeadershipUpdateOutboxRow,
  type OpsStateDeputyMunicipalitiesOutboxRow,
} from '@/components/campaign/opsSync/opsDomainOutboxModel'
import {
  activitiesCollection,
  demandsCollection,
  leadershipsCollection,
  municipalitiesCollection,
} from '@/components/campaign/opsSync/opsMirrorClient'
import { opsOutboxKey, type OpsOutboxKey } from '@/lib/campaignOps/opsContract'
import type { ActivityCreateInput, ActivityUpdateInput } from '@/lib/schemas/activity'
import type { CampaignDemandStatus } from '@/lib/schemas/campaignDemand'
import type { SupportStatus } from '@/lib/schemas/leadership'
import {
  isOpsUpdatedAtConflictMessage,
  parseOpsUpdatedAtConflictServerUpdatedAt,
} from '@/lib/schemas/opsCas'

const LEADERSHIP_UPDATE_FN = 'updateLeadershipInternal'
const LEADERSHIP_CREATE_FN = 'createLeadership'
const DEMAND_TRANSITION_FN = 'transitionCampaignDemand'
const ACTIVITY_UPDATE_FN = 'updateActivity'
const ACTIVITY_CREATE_FN = 'createActivity'
const STATE_DEPUTY_MUNICIPALITIES_FN = 'setStateDeputyMunicipalitiesBatch'
const LEADERSHIP_MEMBERSHIP_FN = 'setLeadershipMembership'

const leadershipUpdateOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsLeadershipUpdateOutboxRow, number>({
    id: 'ops-leadership-update-outbox',
    getKey: (row) => row.leadershipId,
  }),
)

const leadershipCreateOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsLeadershipCreateOutboxRow, string>({
    id: 'ops-leadership-create-outbox',
    getKey: (row) => row.id,
  }),
)

const demandTransitionOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsDemandTransitionOutboxRow, number>({
    id: 'ops-demand-transition-outbox',
    getKey: (row) => row.demandId,
  }),
)

const activityUpdateOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsActivityUpdateOutboxRow, number>({
    id: 'ops-activity-update-outbox',
    getKey: (row) => row.activityId,
  }),
)

const activityCreateOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsActivityCreateOutboxRow, string>({
    id: 'ops-activity-create-outbox',
    getKey: (row) => row.id,
  }),
)

const stateDeputyMunicipalitiesOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsStateDeputyMunicipalitiesOutboxRow, string>({
    id: 'ops-state-deputy-municipalities-outbox',
    getKey: (row) => row.id,
  }),
)

const leadershipMembershipOutboxCollection = createCollection(
  localOnlyCollectionOptions<OpsLeadershipMembershipOutboxRow, string>({
    id: 'ops-leadership-membership-outbox',
    getKey: (row) => row.id,
  }),
)

let executorSingleton: OfflineExecutor | null = null
let initPromise: Promise<OfflineExecutor> | null = null

const collapseAllDomainOutbox = (
  transactions: Parameters<typeof collapseLeadershipUpdateOutbox>[0],
) => {
  const byFn = new Map<string, typeof transactions>()
  for (const transaction of transactions) {
    const fn = transaction.mutationFnName ?? ''
    const list = byFn.get(fn) ?? []
    list.push(transaction)
    byFn.set(fn, list)
  }

  const collapsed = [
    ...(byFn.get(LEADERSHIP_UPDATE_FN)
      ? collapseLeadershipUpdateOutbox(byFn.get(LEADERSHIP_UPDATE_FN)!)
      : []),
    ...(byFn.get(LEADERSHIP_CREATE_FN)
      ? collapseLeadershipCreateOutbox(byFn.get(LEADERSHIP_CREATE_FN)!)
      : []),
    ...(byFn.get(DEMAND_TRANSITION_FN)
      ? collapseDemandTransitionOutbox(byFn.get(DEMAND_TRANSITION_FN)!)
      : []),
    ...(byFn.get(ACTIVITY_UPDATE_FN)
      ? collapseActivityUpdateOutbox(byFn.get(ACTIVITY_UPDATE_FN)!)
      : []),
    ...(byFn.get(ACTIVITY_CREATE_FN)
      ? collapseActivityCreateOutbox(byFn.get(ACTIVITY_CREATE_FN)!)
      : []),
    ...(byFn.get(STATE_DEPUTY_MUNICIPALITIES_FN)
      ? collapseStateDeputyMunicipalitiesOutbox(byFn.get(STATE_DEPUTY_MUNICIPALITIES_FN)!)
      : []),
    ...(byFn.get(LEADERSHIP_MEMBERSHIP_FN)
      ? collapseLeadershipMembershipOutbox(byFn.get(LEADERSHIP_MEMBERSHIP_FN)!)
      : []),
  ]

  for (const [fn, list] of byFn) {
    if (
      fn !== LEADERSHIP_UPDATE_FN &&
      fn !== LEADERSHIP_CREATE_FN &&
      fn !== DEMAND_TRANSITION_FN &&
      fn !== ACTIVITY_UPDATE_FN &&
      fn !== ACTIVITY_CREATE_FN &&
      fn !== STATE_DEPUTY_MUNICIPALITIES_FN &&
      fn !== LEADERSHIP_MEMBERSHIP_FN
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

const createDomainOfflineExecutor = (): OfflineExecutor =>
  startOfflineExecutor({
    collections: {
      leadershipUpdateOutbox: leadershipUpdateOutboxCollection,
      leadershipCreateOutbox: leadershipCreateOutboxCollection,
      demandTransitionOutbox: demandTransitionOutboxCollection,
      activityUpdateOutbox: activityUpdateOutboxCollection,
      activityCreateOutbox: activityCreateOutboxCollection,
      stateDeputyMunicipalitiesOutbox: stateDeputyMunicipalitiesOutboxCollection,
      leadershipMembershipOutbox: leadershipMembershipOutboxCollection,
    },
    storage: new IndexedDBAdapter('teqo-ops-domain', 'outbox'),
    beforeRetry: collapseAllDomainOutbox,
    mutationFns: {
      [LEADERSHIP_UPDATE_FN]: async ({ transaction }) => {
        const mutation = transaction.mutations[0]
        if (!mutation) throw new NonRetriableError('Mutação de liderança vazia.')
        const row = mutation.modified as OpsLeadershipUpdateOutboxRow
        try {
          const updated = await updateLeadershipInternalCas({
            id: row.leadershipId,
            municipalities: row.municipalities,
            organizations: row.organizations,
            stateDeputies: row.stateDeputies,
            exclusive: row.exclusive,
            supportStatus: row.supportStatus,
            notes: row.notes,
            baseUpdatedAt: row.baseUpdatedAt,
          })
          if (leadershipsCollection.has(updated.id)) {
            leadershipsCollection.update(updated.id, (draft) => {
              draft.supportStatus = updated.supportStatus
              draft.exclusive = updated.exclusive
              draft.notes = updated.notes
              draft.municipalities = Array.isArray(updated.municipalities)
                ? updated.municipalities.map((entry) =>
                    typeof entry === 'number' ? entry : entry.id,
                  )
                : draft.municipalities
              draft.stateDeputies = Array.isArray(updated.stateDeputies)
                ? updated.stateDeputies.map((entry) =>
                    typeof entry === 'number' ? entry : entry.id,
                  )
                : draft.stateDeputies
              draft.updatedAt = updated.updatedAt
            })
          }
          leadershipUpdateOutboxCollection.utils.acceptMutations(transaction)
          if (leadershipUpdateOutboxCollection.has(row.leadershipId)) {
            leadershipUpdateOutboxCollection.delete(row.leadershipId)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsUpdatedAtConflictMessage(message)) {
            handleUpdatedAtConflict(message, (serverUpdatedAt) => {
              if (leadershipUpdateOutboxCollection.has(row.leadershipId)) {
                leadershipUpdateOutboxCollection.update(row.leadershipId, (draft) => {
                  draft.status = 'conflict'
                  draft.serverUpdatedAt = serverUpdatedAt
                  draft.errorMessage = message
                })
              }
            })
          }
          if (leadershipUpdateOutboxCollection.has(row.leadershipId)) {
            leadershipUpdateOutboxCollection.update(row.leadershipId, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
      [LEADERSHIP_CREATE_FN]: async ({ transaction }) => {
        const mutation = transaction.mutations[0]
        if (!mutation) throw new NonRetriableError('Mutação de cadastro vazia.')
        const row = mutation.modified as OpsLeadershipCreateOutboxRow
        try {
          await createLeadershipCas({
            name: row.name,
            phone: row.phone,
            email: row.email,
            municipalities: row.municipalities,
            organizations: row.organizations,
            stateDeputies: row.stateDeputies,
            exclusive: row.exclusive,
            supportStatus: row.supportStatus,
            notes: row.notes,
          })
          leadershipCreateOutboxCollection.utils.acceptMutations(transaction)
          if (leadershipCreateOutboxCollection.has(row.id)) {
            leadershipCreateOutboxCollection.delete(row.id)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (leadershipCreateOutboxCollection.has(row.id)) {
            leadershipCreateOutboxCollection.update(row.id, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
      [DEMAND_TRANSITION_FN]: async ({ transaction }) => {
        const mutation = transaction.mutations[0]
        if (!mutation) throw new NonRetriableError('Mutação de demanda vazia.')
        const row = mutation.modified as OpsDemandTransitionOutboxRow
        try {
          const updated = await transitionCampaignDemandCas({
            id: row.demandId,
            status: row.status,
            decisionNote: row.decisionNote,
            baseUpdatedAt: row.baseUpdatedAt,
          })
          if (demandsCollection.has(updated.id)) {
            demandsCollection.update(updated.id, (draft) => {
              draft.status = updated.status
              draft.updatedAt = updated.updatedAt
            })
          }
          demandTransitionOutboxCollection.utils.acceptMutations(transaction)
          if (demandTransitionOutboxCollection.has(row.demandId)) {
            demandTransitionOutboxCollection.delete(row.demandId)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsUpdatedAtConflictMessage(message)) {
            handleUpdatedAtConflict(message, (serverUpdatedAt) => {
              if (demandTransitionOutboxCollection.has(row.demandId)) {
                demandTransitionOutboxCollection.update(row.demandId, (draft) => {
                  draft.statusSync = 'conflict'
                  draft.serverUpdatedAt = serverUpdatedAt
                  draft.errorMessage = message
                })
              }
            })
          }
          if (demandTransitionOutboxCollection.has(row.demandId)) {
            demandTransitionOutboxCollection.update(row.demandId, (draft) => {
              draft.statusSync = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
      [ACTIVITY_UPDATE_FN]: async ({ transaction }) => {
        const mutation = transaction.mutations[0]
        if (!mutation) throw new NonRetriableError('Mutação de atividade vazia.')
        const row = mutation.modified as OpsActivityUpdateOutboxRow
        try {
          const updated = await updateActivityCas({
            id: row.activityId,
            ...row.payload,
            baseUpdatedAt: row.baseUpdatedAt,
          })
          if (activitiesCollection.has(updated.id)) {
            activitiesCollection.update(updated.id, (draft) => {
              draft.title = updated.title
              draft.kind = updated.kind
              draft.status = updated.status
              draft.updatedAt = updated.updatedAt
            })
          }
          activityUpdateOutboxCollection.utils.acceptMutations(transaction)
          if (activityUpdateOutboxCollection.has(row.activityId)) {
            activityUpdateOutboxCollection.delete(row.activityId)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsUpdatedAtConflictMessage(message)) {
            handleUpdatedAtConflict(message, (serverUpdatedAt) => {
              if (activityUpdateOutboxCollection.has(row.activityId)) {
                activityUpdateOutboxCollection.update(row.activityId, (draft) => {
                  draft.status = 'conflict'
                  draft.serverUpdatedAt = serverUpdatedAt
                  draft.errorMessage = message
                })
              }
            })
          }
          if (activityUpdateOutboxCollection.has(row.activityId)) {
            activityUpdateOutboxCollection.update(row.activityId, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
      [ACTIVITY_CREATE_FN]: async ({ transaction }) => {
        const mutation = transaction.mutations[0]
        if (!mutation) throw new NonRetriableError('Mutação de criação de atividade vazia.')
        const row = mutation.modified as OpsActivityCreateOutboxRow
        try {
          await createActivityCas(row.payload)
          activityCreateOutboxCollection.utils.acceptMutations(transaction)
          if (activityCreateOutboxCollection.has(row.id)) {
            activityCreateOutboxCollection.delete(row.id)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (activityCreateOutboxCollection.has(row.id)) {
            activityCreateOutboxCollection.update(row.id, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
      [STATE_DEPUTY_MUNICIPALITIES_FN]: async ({ transaction }) => {
        const mutation = transaction.mutations[0]
        if (!mutation) throw new NonRetriableError('Mutação de municípios da dobradinha vazia.')
        const row = mutation.modified as OpsStateDeputyMunicipalitiesOutboxRow
        try {
          await setStateDeputyMunicipalitiesBatchCas({
            stateDeputyId: row.stateDeputyId,
            municipalityIds: row.municipalityIds,
            assigned: row.assigned,
            municipalityBaseUpdatedAt: row.municipalityBaseUpdatedAt,
          })
          stateDeputyMunicipalitiesOutboxCollection.utils.acceptMutations(transaction)
          if (stateDeputyMunicipalitiesOutboxCollection.has(row.id)) {
            stateDeputyMunicipalitiesOutboxCollection.delete(row.id)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsUpdatedAtConflictMessage(message)) {
            handleUpdatedAtConflict(message, (serverUpdatedAt) => {
              if (stateDeputyMunicipalitiesOutboxCollection.has(row.id)) {
                stateDeputyMunicipalitiesOutboxCollection.update(row.id, (draft) => {
                  draft.status = 'conflict'
                  draft.serverUpdatedAt = serverUpdatedAt
                  draft.errorMessage = message
                })
              }
            })
          }
          if (stateDeputyMunicipalitiesOutboxCollection.has(row.id)) {
            stateDeputyMunicipalitiesOutboxCollection.update(row.id, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
      [LEADERSHIP_MEMBERSHIP_FN]: async ({ transaction }) => {
        const mutation = transaction.mutations[0]
        if (!mutation) throw new NonRetriableError('Mutação de vínculo vazia.')
        const row = mutation.modified as OpsLeadershipMembershipOutboxRow
        try {
          if (row.kind === 'municipalities') {
            await setLeadershipMunicipalitiesMembershipCas({
              leadershipId: row.leadershipId,
              municipalityIds: row.municipalityIds ?? [],
              assigned: row.assigned,
              baseUpdatedAt: row.baseUpdatedAt,
            })
          } else {
            await setLeadershipStateDeputyMembershipCas({
              leadershipId: row.leadershipId,
              stateDeputyId: row.stateDeputyId!,
              assigned: row.assigned,
              baseUpdatedAt: row.baseUpdatedAt,
            })
          }
          leadershipMembershipOutboxCollection.utils.acceptMutations(transaction)
          if (leadershipMembershipOutboxCollection.has(row.id)) {
            leadershipMembershipOutboxCollection.delete(row.id)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isOpsUpdatedAtConflictMessage(message)) {
            handleUpdatedAtConflict(message, (serverUpdatedAt) => {
              if (leadershipMembershipOutboxCollection.has(row.id)) {
                leadershipMembershipOutboxCollection.update(row.id, (draft) => {
                  draft.status = 'conflict'
                  draft.serverUpdatedAt = serverUpdatedAt
                  draft.errorMessage = message
                })
              }
            })
          }
          if (leadershipMembershipOutboxCollection.has(row.id)) {
            leadershipMembershipOutboxCollection.update(row.id, (draft) => {
              draft.status = 'error'
              draft.errorMessage = message
            })
          }
          throw error instanceof Error ? error : new Error(message)
        }
      },
    },
  })

export const getOpsDomainOfflineExecutor = async (): Promise<OfflineExecutor> => {
  if (executorSingleton) {
    await executorSingleton.waitForInit()
    return executorSingleton
  }
  if (!initPromise) {
    initPromise = (async () => {
      const executor = createDomainOfflineExecutor()
      await executor.waitForInit()
      executorSingleton = executor
      return executor
    })()
  }
  return initPromise
}

export const enqueueLeadershipUpdate = async (input: {
  leadershipId: number
  municipalities?: number[]
  organizations?: number[] | null
  stateDeputies?: number[] | null
  exclusive?: boolean
  supportStatus?: SupportStatus
  notes?: string | null
  baseUpdatedAt?: string | null
}): Promise<void> => {
  const executor = await getOpsDomainOfflineExecutor()
  const mirror = leadershipsCollection.get(input.leadershipId)
  const baseUpdatedAt =
    input.baseUpdatedAt !== undefined ? input.baseUpdatedAt : (mirror?.updatedAt ?? null)

  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: LEADERSHIP_UPDATE_FN,
    onMutate: (variables) => {
      const next: OpsLeadershipUpdateOutboxRow = {
        leadershipId: variables.leadershipId,
        municipalities: variables.municipalities,
        organizations: variables.organizations,
        stateDeputies: variables.stateDeputies,
        exclusive: variables.exclusive,
        supportStatus: variables.supportStatus,
        notes: variables.notes,
        baseUpdatedAt: variables.baseUpdatedAt ?? baseUpdatedAt,
        status: 'pending',
      }
      if (leadershipsCollection.has(variables.leadershipId)) {
        leadershipsCollection.update(variables.leadershipId, (draft) => {
          if (variables.supportStatus !== undefined) draft.supportStatus = variables.supportStatus
          if (variables.exclusive !== undefined) draft.exclusive = variables.exclusive
          if (variables.notes !== undefined) draft.notes = variables.notes
          if (variables.municipalities !== undefined) draft.municipalities = variables.municipalities
          if (variables.stateDeputies !== undefined) {
            draft.stateDeputies = variables.stateDeputies ?? []
          }
        })
      }
      if (leadershipUpdateOutboxCollection.has(variables.leadershipId)) {
        leadershipUpdateOutboxCollection.update(variables.leadershipId, (draft) => {
          Object.assign(draft, next)
          draft.serverUpdatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        leadershipUpdateOutboxCollection.insert(next)
      }
    },
  })
  run({ ...input, baseUpdatedAt })
}

export const enqueueLeadershipCreate = async (input: {
  clientId: string
  name: string
  phone: string
  email?: string | null
  municipalities: number[]
  organizations?: number[]
  stateDeputies?: number[]
  exclusive?: boolean
  supportStatus?: SupportStatus
  notes?: string
}): Promise<void> => {
  const executor = await getOpsDomainOfflineExecutor()
  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: LEADERSHIP_CREATE_FN,
    onMutate: (variables) => {
      const next: OpsLeadershipCreateOutboxRow = {
        id: variables.clientId,
        name: variables.name,
        phone: variables.phone,
        email: variables.email,
        municipalities: variables.municipalities,
        organizations: variables.organizations,
        stateDeputies: variables.stateDeputies,
        exclusive: variables.exclusive,
        supportStatus: variables.supportStatus,
        notes: variables.notes,
        status: 'pending',
      }
      if (leadershipCreateOutboxCollection.has(next.id)) {
        leadershipCreateOutboxCollection.update(next.id, (draft) => {
          Object.assign(draft, next)
        })
      } else {
        leadershipCreateOutboxCollection.insert(next)
      }
    },
  })
  run(input)
}

export const enqueueDemandTransition = async (input: {
  demandId: number
  status: CampaignDemandStatus
  decisionNote?: string | null
  baseUpdatedAt?: string | null
}): Promise<void> => {
  const executor = await getOpsDomainOfflineExecutor()
  const mirror = demandsCollection.get(input.demandId)
  const baseUpdatedAt =
    input.baseUpdatedAt !== undefined ? input.baseUpdatedAt : (mirror?.updatedAt ?? null)

  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: DEMAND_TRANSITION_FN,
    onMutate: (variables) => {
      const next: OpsDemandTransitionOutboxRow = {
        demandId: variables.demandId,
        status: variables.status,
        decisionNote: variables.decisionNote,
        baseUpdatedAt: variables.baseUpdatedAt ?? baseUpdatedAt,
        statusSync: 'pending',
      }
      if (demandsCollection.has(variables.demandId)) {
        demandsCollection.update(variables.demandId, (draft) => {
          draft.status = variables.status
        })
      }
      if (demandTransitionOutboxCollection.has(variables.demandId)) {
        demandTransitionOutboxCollection.update(variables.demandId, (draft) => {
          Object.assign(draft, next)
          draft.serverUpdatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        demandTransitionOutboxCollection.insert(next)
      }
    },
  })
  run({ ...input, baseUpdatedAt })
}

export const enqueueActivityUpdate = async (input: {
  activityId: number
  payload: Omit<ActivityUpdateInput, 'id' | 'baseUpdatedAt'>
  baseUpdatedAt?: string | null
}): Promise<void> => {
  const executor = await getOpsDomainOfflineExecutor()
  const mirror = activitiesCollection.get(input.activityId)
  const baseUpdatedAt =
    input.baseUpdatedAt !== undefined ? input.baseUpdatedAt : (mirror?.updatedAt ?? null)

  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: ACTIVITY_UPDATE_FN,
    onMutate: (variables) => {
      const next: OpsActivityUpdateOutboxRow = {
        activityId: variables.activityId,
        payload: variables.payload,
        baseUpdatedAt: variables.baseUpdatedAt ?? baseUpdatedAt,
        status: 'pending',
      }
      if (activitiesCollection.has(variables.activityId) && variables.payload.title) {
        activitiesCollection.update(variables.activityId, (draft) => {
          if (variables.payload.title) draft.title = variables.payload.title
          if (variables.payload.kind) draft.kind = variables.payload.kind
          if (variables.payload.status) draft.status = variables.payload.status
        })
      }
      if (activityUpdateOutboxCollection.has(variables.activityId)) {
        activityUpdateOutboxCollection.update(variables.activityId, (draft) => {
          Object.assign(draft, next)
          draft.serverUpdatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        activityUpdateOutboxCollection.insert(next)
      }
    },
  })
  run({ ...input, baseUpdatedAt })
}

export const enqueueActivityCreate = async (input: {
  clientId: string
  payload: ActivityCreateInput
}): Promise<void> => {
  const executor = await getOpsDomainOfflineExecutor()
  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: ACTIVITY_CREATE_FN,
    onMutate: (variables) => {
      const next: OpsActivityCreateOutboxRow = {
        id: variables.clientId,
        payload: variables.payload,
        status: 'pending',
      }
      if (activityCreateOutboxCollection.has(next.id)) {
        activityCreateOutboxCollection.update(next.id, (draft) => {
          Object.assign(draft, next)
        })
      } else {
        activityCreateOutboxCollection.insert(next)
      }
    },
  })
  run(input)
}

export const enqueueStateDeputyMunicipalities = async (input: {
  stateDeputyId: number
  municipalityIds: number[]
  assigned: boolean
  municipalityBaseUpdatedAt?: Record<string, string | null | undefined>
}): Promise<void> => {
  const executor = await getOpsDomainOfflineExecutor()
  const id = stateDeputyMunicipalitiesOutboxKey(
    input.stateDeputyId,
    input.municipalityIds,
    input.assigned,
  )
  const municipalityBaseUpdatedAt =
    input.municipalityBaseUpdatedAt ??
    Object.fromEntries(
      input.municipalityIds.map((municipalityId) => [
        String(municipalityId),
        municipalitiesCollection.get(municipalityId)?.updatedAt ?? null,
      ]),
    )

  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: STATE_DEPUTY_MUNICIPALITIES_FN,
    onMutate: (variables) => {
      const next: OpsStateDeputyMunicipalitiesOutboxRow = {
        id,
        stateDeputyId: variables.stateDeputyId,
        municipalityIds: variables.municipalityIds,
        assigned: variables.assigned,
        municipalityBaseUpdatedAt: variables.municipalityBaseUpdatedAt ?? municipalityBaseUpdatedAt,
        status: 'pending',
      }
      if (stateDeputyMunicipalitiesOutboxCollection.has(id)) {
        stateDeputyMunicipalitiesOutboxCollection.update(id, (draft) => {
          Object.assign(draft, next)
          draft.serverUpdatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        stateDeputyMunicipalitiesOutboxCollection.insert(next)
      }
    },
  })
  run({ ...input, municipalityBaseUpdatedAt })
}

export const enqueueLeadershipMunicipalitiesMembership = async (input: {
  leadershipId: number
  municipalityIds: number[]
  assigned: boolean
  baseUpdatedAt?: string | null
}): Promise<void> => {
  const executor = await getOpsDomainOfflineExecutor()
  const targetId = input.municipalityIds[0] ?? 0
  const id = leadershipMembershipOutboxKey('municipalities', input.leadershipId, targetId)
  const mirror = leadershipsCollection.get(input.leadershipId)
  const baseUpdatedAt =
    input.baseUpdatedAt !== undefined ? input.baseUpdatedAt : (mirror?.updatedAt ?? null)

  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: LEADERSHIP_MEMBERSHIP_FN,
    onMutate: (variables) => {
      const next: OpsLeadershipMembershipOutboxRow = {
        id,
        kind: 'municipalities',
        leadershipId: variables.leadershipId,
        municipalityIds: variables.municipalityIds,
        assigned: variables.assigned,
        baseUpdatedAt: variables.baseUpdatedAt ?? baseUpdatedAt,
        status: 'pending',
      }
      if (leadershipMembershipOutboxCollection.has(id)) {
        leadershipMembershipOutboxCollection.update(id, (draft) => {
          Object.assign(draft, next)
          draft.serverUpdatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        leadershipMembershipOutboxCollection.insert(next)
      }
    },
  })
  run({ ...input, baseUpdatedAt })
}

export const enqueueLeadershipStateDeputyMembership = async (input: {
  leadershipId: number
  stateDeputyId: number
  assigned: boolean
  baseUpdatedAt?: string | null
}): Promise<void> => {
  const executor = await getOpsDomainOfflineExecutor()
  const id = leadershipMembershipOutboxKey('stateDeputies', input.leadershipId, input.stateDeputyId)
  const mirror = leadershipsCollection.get(input.leadershipId)
  const baseUpdatedAt =
    input.baseUpdatedAt !== undefined ? input.baseUpdatedAt : (mirror?.updatedAt ?? null)

  const run = executor.createOfflineAction<typeof input>({
    mutationFnName: LEADERSHIP_MEMBERSHIP_FN,
    onMutate: (variables) => {
      const next: OpsLeadershipMembershipOutboxRow = {
        id,
        kind: 'stateDeputies',
        leadershipId: variables.leadershipId,
        stateDeputyId: variables.stateDeputyId,
        assigned: variables.assigned,
        baseUpdatedAt: variables.baseUpdatedAt ?? baseUpdatedAt,
        status: 'pending',
      }
      if (leadershipMembershipOutboxCollection.has(id)) {
        leadershipMembershipOutboxCollection.update(id, (draft) => {
          Object.assign(draft, next)
          draft.serverUpdatedAt = undefined
          draft.errorMessage = undefined
        })
      } else {
        leadershipMembershipOutboxCollection.insert(next)
      }
    },
  })
  run({ ...input, baseUpdatedAt })
}

export const collectOpsDomainOutboxKeys = (): Set<OpsOutboxKey> => {
  const keys = new Set<OpsOutboxKey>()
  for (const row of leadershipUpdateOutboxCollection.toArray) {
    if (row.status === 'pending' || row.status === 'conflict') {
      keys.add(opsOutboxKey('leaderships', row.leadershipId))
    }
  }
  for (const row of demandTransitionOutboxCollection.toArray) {
    if (row.statusSync === 'pending' || row.statusSync === 'conflict') {
      keys.add(opsOutboxKey('demands', row.demandId))
    }
  }
  for (const row of activityUpdateOutboxCollection.toArray) {
    if (row.status === 'pending' || row.status === 'conflict') {
      keys.add(opsOutboxKey('activities', row.activityId))
    }
  }
  for (const row of stateDeputyMunicipalitiesOutboxCollection.toArray) {
    if (row.status === 'pending' || row.status === 'conflict') {
      for (const municipalityId of row.municipalityIds) {
        keys.add(opsOutboxKey('municipalities', municipalityId))
      }
    }
  }
  for (const row of leadershipMembershipOutboxCollection.toArray) {
    if (row.status === 'pending' || row.status === 'conflict') {
      keys.add(opsOutboxKey('leaderships', row.leadershipId))
    }
  }
  return keys
}

export const readOpsLeadershipUpdateOutboxRow = (
  leadershipId: number,
): OpsLeadershipUpdateOutboxRow | undefined => leadershipUpdateOutboxCollection.get(leadershipId)

export const subscribeOpsLeadershipUpdateOutboxRow = (
  leadershipId: number,
  onStoreChange: () => void,
): (() => void) => {
  let previous = leadershipUpdateOutboxCollection.get(leadershipId)
  const subscription = leadershipUpdateOutboxCollection.subscribeChanges(() => {
    const next = leadershipUpdateOutboxCollection.get(leadershipId)
    if (next === previous) return
    previous = next
    onStoreChange()
  })
  return () => subscription.unsubscribe()
}

export const discardOpsLeadershipUpdateOutboxRow = (leadershipId: number): void => {
  if (leadershipUpdateOutboxCollection.has(leadershipId)) {
    leadershipUpdateOutboxCollection.delete(leadershipId)
  }
}

export const readOpsDemandTransitionOutboxRow = (
  demandId: number,
): OpsDemandTransitionOutboxRow | undefined => demandTransitionOutboxCollection.get(demandId)

export const subscribeOpsDemandTransitionOutboxRow = (
  demandId: number,
  onStoreChange: () => void,
): (() => void) => {
  let previous = demandTransitionOutboxCollection.get(demandId)
  const subscription = demandTransitionOutboxCollection.subscribeChanges(() => {
    const next = demandTransitionOutboxCollection.get(demandId)
    if (next === previous) return
    previous = next
    onStoreChange()
  })
  return () => subscription.unsubscribe()
}

export const discardOpsDemandTransitionOutboxRow = (demandId: number): void => {
  if (demandTransitionOutboxCollection.has(demandId)) {
    demandTransitionOutboxCollection.delete(demandId)
  }
}

export const readOpsActivityUpdateOutboxRow = (
  activityId: number,
): OpsActivityUpdateOutboxRow | undefined => activityUpdateOutboxCollection.get(activityId)

export const subscribeOpsActivityUpdateOutboxRow = (
  activityId: number,
  onStoreChange: () => void,
): (() => void) => {
  let previous = activityUpdateOutboxCollection.get(activityId)
  const subscription = activityUpdateOutboxCollection.subscribeChanges(() => {
    const next = activityUpdateOutboxCollection.get(activityId)
    if (next === previous) return
    previous = next
    onStoreChange()
  })
  return () => subscription.unsubscribe()
}

export const discardOpsActivityUpdateOutboxRow = (activityId: number): void => {
  if (activityUpdateOutboxCollection.has(activityId)) {
    activityUpdateOutboxCollection.delete(activityId)
  }
}

const wipeDomainOutboxCollections = (): void => {
  for (const row of leadershipUpdateOutboxCollection.toArray) {
    if (leadershipUpdateOutboxCollection.has(row.leadershipId)) {
      leadershipUpdateOutboxCollection.delete(row.leadershipId)
    }
  }
  for (const row of leadershipCreateOutboxCollection.toArray) {
    if (leadershipCreateOutboxCollection.has(row.id)) {
      leadershipCreateOutboxCollection.delete(row.id)
    }
  }
  for (const row of demandTransitionOutboxCollection.toArray) {
    if (demandTransitionOutboxCollection.has(row.demandId)) {
      demandTransitionOutboxCollection.delete(row.demandId)
    }
  }
  for (const row of activityUpdateOutboxCollection.toArray) {
    if (activityUpdateOutboxCollection.has(row.activityId)) {
      activityUpdateOutboxCollection.delete(row.activityId)
    }
  }
  for (const row of activityCreateOutboxCollection.toArray) {
    if (activityCreateOutboxCollection.has(row.id)) {
      activityCreateOutboxCollection.delete(row.id)
    }
  }
  for (const row of stateDeputyMunicipalitiesOutboxCollection.toArray) {
    if (stateDeputyMunicipalitiesOutboxCollection.has(row.id)) {
      stateDeputyMunicipalitiesOutboxCollection.delete(row.id)
    }
  }
  for (const row of leadershipMembershipOutboxCollection.toArray) {
    if (leadershipMembershipOutboxCollection.has(row.id)) {
      leadershipMembershipOutboxCollection.delete(row.id)
    }
  }
}

/** Logout wipe — outbox storage + in-memory rows (OH11/OH13). */
export const clearOpsDomainOutboxForLogout = async (): Promise<void> => {
  if (executorSingleton) {
    try {
      await executorSingleton.clearOutbox()
      executorSingleton.dispose()
    } catch {
      // Best effort — private mode / torn-down storage.
    }
    executorSingleton = null
    initPromise = null
  }
  wipeDomainOutboxCollections()
}
