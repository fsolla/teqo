import { relationshipId, requireRelationshipId } from '@/lib/relationship'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'

import type { OpsVotePledge } from './opsContract'

/** Minimal write response shape from `estimateVotesCas` (depth 0). */
export type VotePledgeEstimateWriteResult = {
  id: number
  leadership: unknown
  municipality: unknown
  declaredVotes: number
  declaredAt?: string | null
  declaredBy?: unknown
  updatedAt: string
  estimatedVotes?: {
    pessimistic?: number | null
    central?: number | null
    optimistic?: number | null
  } | null
  estimateNote?: string | null
  estimatedBy?: unknown
  estimatedAt?: string | null
}

export const mapVotePledgeWriteToOps = (doc: VotePledgeEstimateWriteResult): OpsVotePledge => ({
  id: doc.id,
  leadership: requireRelationshipId(doc.leadership, 'votePledge write: missing leadership'),
  municipality: requireRelationshipId(doc.municipality, 'votePledge write: missing municipality'),
  declaredVotes: doc.declaredVotes,
  declaredAt: doc.declaredAt ?? null,
  declaredBy: relationshipId(doc.declaredBy),
  updatedAt: doc.updatedAt,
  estimatedVotes: toVoteEstimateScenarioViewModel(doc.estimatedVotes),
  estimateNote: doc.estimateNote ?? null,
  estimatedBy: relationshipId(doc.estimatedBy),
  estimatedAt: doc.estimatedAt ?? null,
})
