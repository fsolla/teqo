import type { OfflineTransaction } from '@tanstack/offline-transactions'

import type { ActivityCreateInput, ActivityUpdateInput } from '@/lib/schemas/activity'
import type { CampaignDemandStatus } from '@/lib/schemas/campaignDemand'
import type { SupportStatus } from '@/lib/schemas/leadership'

export type OpsDomainWriteSyncStatus = 'pending' | 'synced' | 'conflict' | 'error'

export type OpsLeadershipUpdateOutboxRow = {
  leadershipId: number
  municipalities?: number[]
  organizations?: number[] | null
  stateDeputies?: number[] | null
  exclusive?: boolean
  supportStatus?: SupportStatus
  notes?: string | null
  baseUpdatedAt?: string | null
  status: OpsDomainWriteSyncStatus
  serverUpdatedAt?: string | null
  errorMessage?: string
}

export type OpsLeadershipCreateOutboxRow = {
  id: string
  name: string
  phone: string
  email?: string | null
  municipalities: number[]
  organizations?: number[]
  stateDeputies?: number[]
  exclusive?: boolean
  supportStatus?: SupportStatus
  notes?: string
  status: OpsDomainWriteSyncStatus
  errorMessage?: string
}

export type OpsDemandTransitionOutboxRow = {
  demandId: number
  status: CampaignDemandStatus
  decisionNote?: string | null
  baseUpdatedAt?: string | null
  statusSync: OpsDomainWriteSyncStatus
  serverUpdatedAt?: string | null
  errorMessage?: string
}

export type OpsActivityUpdateOutboxRow = {
  activityId: number
  payload: Omit<ActivityUpdateInput, 'id' | 'baseUpdatedAt'>
  baseUpdatedAt?: string | null
  status: OpsDomainWriteSyncStatus
  serverUpdatedAt?: string | null
  errorMessage?: string
}

export type OpsActivityCreateOutboxRow = {
  id: string
  payload: ActivityCreateInput
  status: OpsDomainWriteSyncStatus
  errorMessage?: string
}

export type OpsStateDeputyMunicipalitiesOutboxRow = {
  id: string
  stateDeputyId: number
  municipalityIds: number[]
  assigned: boolean
  municipalityBaseUpdatedAt?: Record<string, string | null | undefined>
  status: OpsDomainWriteSyncStatus
  serverUpdatedAt?: string | null
  conflictMunicipalityId?: number
  errorMessage?: string
}

export type OpsLeadershipMembershipOutboxRow = {
  id: string
  kind: 'municipalities' | 'stateDeputies'
  leadershipId: number
  municipalityIds?: number[]
  stateDeputyId?: number
  assigned: boolean
  baseUpdatedAt?: string | null
  status: OpsDomainWriteSyncStatus
  serverUpdatedAt?: string | null
  errorMessage?: string
}

const collapseByMetadataKey = (
  transactions: OfflineTransaction[],
  metadataKey: string,
): OfflineTransaction[] => {
  const latestByKey = new Map<string, OfflineTransaction>()

  for (const transaction of transactions) {
    const raw = transaction.metadata?.[metadataKey]
    const key =
      typeof raw === 'number' || typeof raw === 'string'
        ? String(raw)
        : String(transaction.mutations[0]?.key ?? transaction.id)
    const current = latestByKey.get(key)
    if (!current || transaction.createdAt.getTime() >= current.createdAt.getTime()) {
      latestByKey.set(key, transaction)
    }
  }

  return [...latestByKey.values()].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  )
}

export const collapseLeadershipUpdateOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'leadershipId')

export const collapseLeadershipCreateOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'clientId')

export const collapseDemandTransitionOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'demandId')

export const collapseActivityUpdateOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'activityId')

export const collapseActivityCreateOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'clientId')

export const collapseStateDeputyMunicipalitiesOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'batchKey')

export const collapseLeadershipMembershipOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'membershipKey')

export const leadershipMembershipOutboxKey = (
  kind: 'municipalities' | 'stateDeputies',
  leadershipId: number,
  targetId: number,
): string => `${kind}:${leadershipId}:${targetId}`

export const stateDeputyMunicipalitiesOutboxKey = (
  stateDeputyId: number,
  municipalityIds: readonly number[],
  assigned: boolean,
): string =>
  `${stateDeputyId}:${assigned ? 'add' : 'remove'}:${[...municipalityIds].sort((a, b) => a - b).join(',')}`
