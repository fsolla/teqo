import type { NucleusPriority } from '@/lib/schemas/nucleus'
import type { CampaignUser, NucleusUpdate } from '@/payload-types'
import type { ActionPlanUpcomingPreviewRecord } from '@/utilities/actionPlanUpcomingPreview'
import type { NucleusBaseline2022OverviewAggregate, NucleusConversionOverviewAggregate, NucleusTrendOverviewAggregate } from '@/utilities/nucleusElectoralBaseline'
import type { NucleusChoroplethBundle } from '@/utilities/nucleusChoroplethTypes'
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
  baseline2022: NucleusBaseline2022OverviewAggregate | null
  voteGoals: VoteGoalsSumViewModel
  highPriorityCount: number
  /** Null when no nucleus in the filtered set has resolvable TSE geography. */
  trend: NucleusTrendOverviewAggregate | null
  /** Null when no comparable nucleus has aptos + confirmed estimate. */
  conversion: NucleusConversionOverviewAggregate | null
  recentUpdates: NucleusListOverviewUpdateRecord[]
  upcomingActionPlans: ActionPlanUpcomingPreviewRecord[]
  choropleth: NucleusChoroplethBundle
}

const percentage = (part: number, total: number): number =>
  total === 0 ? 0 : Math.round((part / total) * 100)

export const buildNucleusListOverviewViewModel = ({
  nuclei,
  recentUpdates,
  role,
  upcomingActionPlans,
  baseline2022 = null,
  trend = null,
  conversion = null,
  choropleth,
}: {
  nuclei: NucleusListOverviewNucleusRecord[]
  recentUpdates: NucleusListOverviewUpdateRecord[]
  role: CampaignUser['role']
  upcomingActionPlans: ActionPlanUpcomingPreviewRecord[]
  baseline2022?: NucleusBaseline2022OverviewAggregate | null
  trend?: NucleusTrendOverviewAggregate | null
  conversion?: NucleusConversionOverviewAggregate | null
  choropleth: NucleusChoroplethBundle
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
    trend,
    conversion,
    recentUpdates,
    upcomingActionPlans,
    choropleth,
  }
}
