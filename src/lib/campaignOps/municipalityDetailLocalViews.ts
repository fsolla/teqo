import type { OpsLeadership, OpsMunicipality, OpsVotePledge } from '@/lib/campaignOps/opsContract'
import {
  toVoteEstimateScenarioViewModel,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'

/** Mirror→panel row — structural match for `StaffPledgeRow` without importing utilities. */
export type OpsLocalStaffPledgeRow = {
  id: number
  leadershipID: number
  contactName: string
  declaredVotes: number
  declaredAt: string | null
  estimatedVotes: VoteEstimateScenarioViewModel
  estimateNote: string | null
  estimatedAt: string | null
}

export const findOpsMunicipalityBySlug = (
  municipalities: ReadonlyArray<OpsMunicipality>,
  slug: string,
): OpsMunicipality | null => municipalities.find((row) => row.slug === slug) ?? null

export const toLocalStaffPledgeRows = (
  municipalityId: number,
  pledges: ReadonlyArray<OpsVotePledge>,
  leaderships: ReadonlyArray<OpsLeadership>,
): OpsLocalStaffPledgeRow[] => {
  const leadershipById = new Map(leaderships.map((row) => [row.id, row]))

  return pledges
    .filter((pledge) => pledge.municipality === municipalityId)
    .map((pledge) => {
      const leadership = leadershipById.get(pledge.leadership)
      return {
        id: pledge.id,
        leadershipID: pledge.leadership,
        contactName: leadership?.contact.name ?? 'Liderança',
        declaredVotes: pledge.declaredVotes,
        declaredAt: pledge.declaredAt ?? null,
        estimatedVotes: toVoteEstimateScenarioViewModel(pledge.estimatedVotes),
        estimateNote: pledge.estimateNote ?? null,
        estimatedAt: pledge.estimatedAt ?? null,
      }
    })
    .sort((left, right) => left.contactName.localeCompare(right.contactName, 'pt-BR'))
}
