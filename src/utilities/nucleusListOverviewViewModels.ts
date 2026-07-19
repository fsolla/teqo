import type { NucleusPriority } from '@/lib/schemas/nucleus'
import type { CampaignUser, NucleusUpdate } from '@/payload-types'
import type { ActionPlanUpcomingPreviewRecord } from '@/utilities/actionPlanUpcomingPreview'
import type { NucleusBaseline2022OverviewAggregate } from '@/utilities/nucleusElectoralBaseline'
import {
  aggregateVoteGoals,
  type VoteGoalsSumViewModel,
  type VoteGoalsViewModel,
} from '@/utilities/voteGoals'

export const nucleusListOverviewPreviewLimit = 3

export type NucleusListOverviewNucleusRecord = {
  id: number
  slug: string
  name: string
  coordinators: Array<number | { id: number }>
  cities: string[]
  regions: string[]
  tseZones: number[]
  confirmedVoteEstimate: number | null
  proposedVoteEstimate: number | null
  voteGoals: VoteGoalsViewModel
  priority: NucleusPriority
}

export type NucleusListOverviewBaseline2022 = NucleusBaseline2022OverviewAggregate

export type NucleusListOverviewUpdateRecord = {
  id: number
  nucleusSlug: string
  nucleusName: string
  authorName: string
  kind: NucleusUpdate['kind']
  createdAt: string
}

export type NucleusListOverviewViewModel = {
  totalFiltered: number
  estimate: {
    confirmedTotal: number
    confirmedCount: number
    confirmedPercent: number
    unconfirmedCount: number
    pendingSuggestionsCount?: number
  }
  coverage: {
    coordinatedCount: number
    percent: number
  }
  /** Null when no nucleus in the filtered set has resolvable TSE geography. */
  baseline2022: NucleusListOverviewBaseline2022 | null
  voteGoals: VoteGoalsSumViewModel
  highPriorityCount: number
  recentUpdates: NucleusListOverviewUpdateRecord[]
  upcomingActionPlans: ActionPlanUpcomingPreviewRecord[]
}

const percentage = (part: number, total: number): number =>
  total === 0 ? 0 : Math.round((part / total) * 100)

export const buildNucleusListOverviewViewModel = ({
  nuclei,
  recentUpdates,
  role,
  upcomingActionPlans,
  baseline2022 = null,
}: {
  nuclei: NucleusListOverviewNucleusRecord[]
  recentUpdates: NucleusListOverviewUpdateRecord[]
  role: CampaignUser['role']
  upcomingActionPlans: ActionPlanUpcomingPreviewRecord[]
  baseline2022?: NucleusListOverviewBaseline2022 | null
}): NucleusListOverviewViewModel => {
  const totalFiltered = nuclei.length
  const confirmedCount = nuclei.filter(
    ({ confirmedVoteEstimate }) => confirmedVoteEstimate !== null,
  ).length
  const coordinatedCount = nuclei.filter(({ coordinators }) => coordinators.length > 0).length
  const { highPriorityCount, ...voteGoals } = aggregateVoteGoals(nuclei)

  return {
    totalFiltered,
    estimate: {
      confirmedTotal: nuclei.reduce(
        (sum, nucleus) => sum + (nucleus.confirmedVoteEstimate ?? 0),
        0,
      ),
      confirmedCount,
      confirmedPercent: percentage(confirmedCount, totalFiltered),
      unconfirmedCount: totalFiltered - confirmedCount,
      ...(role === 'lideranca'
        ? {}
        : {
            pendingSuggestionsCount: nuclei.filter(
              ({ proposedVoteEstimate }) => proposedVoteEstimate !== null,
            ).length,
          }),
    },
    coverage: {
      coordinatedCount,
      percent: percentage(coordinatedCount, totalFiltered),
    },
    baseline2022,
    voteGoals,
    highPriorityCount,
    recentUpdates,
    upcomingActionPlans,
  }
}
