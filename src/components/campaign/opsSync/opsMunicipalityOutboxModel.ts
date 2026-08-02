import type { OfflineTransaction } from '@tanstack/offline-transactions'

import type { EngagementLevel } from '@/lib/engagementLevel'
import type { PoliticalTrendStatusValue } from '@/lib/schemas/municipality'
import type {
  MunicipalitySignalType,
  MunicipalityUpdateKind,
} from '@/lib/schemas/municipalityUpdate'

export type OpsMunicipalityWriteSyncStatus = 'pending' | 'synced' | 'conflict' | 'error'

export type OpsDeclareVotesOutboxRow = {
  id: string
  municipalityId: number
  leadershipId: number
  /** Mirror pledge id when known — avoids O(n) lookup in collectOutboxKeys. */
  pledgeId?: number
  declaredVotes: number
  baseUpdatedAt?: string | null
  status: OpsMunicipalityWriteSyncStatus
  serverUpdatedAt?: string | null
  errorMessage?: string
}

export type OpsMunicipalityUpdateOutboxRow = {
  id: string
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
  status: OpsMunicipalityWriteSyncStatus
  serverUpdatedAt?: string | null
  errorMessage?: string
}

export type OpsPoliticalTrendOutboxRow = {
  municipalityId: number
  status: PoliticalTrendStatusValue | null
  note: string | null
  baseUpdatedAt?: string | null
  statusSync: OpsMunicipalityWriteSyncStatus
  serverUpdatedAt?: string | null
  errorMessage?: string
}

export type OpsEngagementLevelOutboxRow = {
  municipalityId: number
  level: EngagementLevel
  note: string
  reversalSignals: string
  triangulatedShock: boolean
  override: boolean
  baseUpdatedAt?: string | null
  status: OpsMunicipalityWriteSyncStatus
  serverUpdatedAt?: string | null
  errorMessage?: string
}

export type OpsAdvisorsOutboxRow = {
  municipalityId: number
  advisors: number[]
  baseUpdatedAt?: string | null
  status: OpsMunicipalityWriteSyncStatus
  serverUpdatedAt?: string | null
  errorMessage?: string
}

/** Collapse declare-votes retries to the newest per leadership×municipality. */
export const collapseDeclareVotesOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'declareKey')

/** Feed creates are append-only — keep every distinct client id. */
export const collapseMunicipalityUpdateOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'clientId')

export const collapsePoliticalTrendOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'municipalityId')

export const collapseEngagementLevelOutbox = (
  transactions: OfflineTransaction[],
): OfflineTransaction[] => collapseByMetadataKey(transactions, 'municipalityId')

export const collapseAdvisorsOutbox = (transactions: OfflineTransaction[]): OfflineTransaction[] =>
  collapseByMetadataKey(transactions, 'municipalityId')

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

export const declareVotesOutboxKey = (leadershipId: number, municipalityId: number): string =>
  `${leadershipId}:${municipalityId}`
