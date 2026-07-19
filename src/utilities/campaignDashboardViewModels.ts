import type { CampaignUser, ElectoralNucleus } from '@/payload-types'
import type { NucleusPriority } from '@/lib/schemas/nucleus'
import type { SupportStatus } from '@/lib/schemas/leadership'
import type { ActionPlanUpcomingPreviewRecord } from '@/utilities/actionPlanUpcomingPreview'
import { formatNucleusTerritoryLabel } from '@/utilities/nucleusUi'
import { sumVoteGoals, type VoteGoalsViewModel } from '@/utilities/voteGoals'

export type CoordinatorSummary = {
  id: number
  name: string
  phone: string | null
}

export type DashboardNucleusRecord = {
  id: number
  name: string
  slug: string
  regions: string[]
  cities: string[]
  neighborhoods: string[]
  locality: string | null
  organizationKind: ElectoralNucleus['organizationKind']
  organizationLabel: string | null
  coordinators: CoordinatorSummary[]
  tseZones: number[]
  confirmedVoteEstimate: number | null
  proposedVoteEstimate: number | null
  voteGoals: VoteGoalsViewModel
  priority: NucleusPriority
  lastUpdateAt: string | null
}

export type DashboardLeadershipRecord = {
  nucleusId: number
  supportStatus: SupportStatus
}

export type DashboardQueueItem = {
  id: number
  slug: string
  name: string
  territory: string
  tseZones: number[]
  confirmedVoteEstimate: number | null
  proposedVoteEstimate: number | null
  lastUpdateAt: string | null
}

export type GeneralDashboardViewModel = {
  role: 'geral'
  kpis: {
    activeNuclei: number
    coordinatorCoveragePercent: number
    confirmedVoteEstimateTotal: number
    confirmedEstimatePercent: number
    regularVoteGoalTotal: number
    updatesThisWeek: number
  }
  supportCounts: Record<SupportStatus, number>
  queues: {
    withoutCoordinator: DashboardQueueItem[]
    withoutRecentUpdate: DashboardQueueItem[]
    pendingEstimate: DashboardQueueItem[]
  }
  upcomingActionPlans: ActionPlanUpcomingPreviewRecord[]
}

export type CoordinatorDashboardCard = {
  id: number
  slug: string
  name: string
  territory: string
  organization: string
  tseZones: number[]
  confirmedVoteEstimate: number | null
  hasPendingEstimate: boolean
  lastUpdateAt: string | null
  isUpdateOverdue: boolean
  leadershipCounts: {
    engaged: number
    toApproach: number
    disputed: number
  }
}

export type LeadershipDashboardCard = {
  id: number
  slug: string
  name: string
  territory: string
  organization: string
  tseZones: number[]
  confirmedVoteEstimate: number | null
  coordinators: Array<{
    name: string
    phone: string | null
  }>
}

export type ScopedDashboardViewModel =
  | {
      role: 'coordenador'
      cards: CoordinatorDashboardCard[]
      upcomingActionPlans: ActionPlanUpcomingPreviewRecord[]
    }
  | {
      role: 'lideranca'
      cards: LeadershipDashboardCard[]
      upcomingActionPlans: ActionPlanUpcomingPreviewRecord[]
    }

const percentage = (part: number, total: number): number =>
  total === 0 ? 0 : Math.round((part / total) * 100)

const isOverdue = (lastUpdateAt: string | null, now: Date): boolean =>
  !lastUpdateAt || now.getTime() - new Date(lastUpdateAt).getTime() > 7 * 24 * 60 * 60 * 1000

const territoryLabel = (nucleus: DashboardNucleusRecord): string =>
  formatNucleusTerritoryLabel(nucleus) || 'Território não informado'

const organizationLabel = ({
  organizationKind,
  organizationLabel: customLabel,
}: DashboardNucleusRecord): string => customLabel ?? organizationKind

const toQueueItem = (nucleus: DashboardNucleusRecord): DashboardQueueItem => ({
  id: nucleus.id,
  slug: nucleus.slug,
  name: nucleus.name,
  territory: territoryLabel(nucleus),
  tseZones: nucleus.tseZones,
  confirmedVoteEstimate: nucleus.confirmedVoteEstimate,
  proposedVoteEstimate: nucleus.proposedVoteEstimate,
  lastUpdateAt: nucleus.lastUpdateAt,
})

const aggregateLeaderships = (leaderships: DashboardLeadershipRecord[]) => {
  const supportCounts: GeneralDashboardViewModel['supportCounts'] = {
    engajado: 0,
    a_abordar: 0,
    em_disputa: 0,
    negativo: 0,
  }
  const countsByNucleus = new Map<number, CoordinatorDashboardCard['leadershipCounts']>()
  const nucleusCountKeys: Record<
    SupportStatus,
    keyof CoordinatorDashboardCard['leadershipCounts'] | null
  > = {
    engajado: 'engaged',
    a_abordar: 'toApproach',
    em_disputa: 'disputed',
    negativo: null,
  }

  for (const leadership of leaderships) {
    supportCounts[leadership.supportStatus] += 1
    const counts = countsByNucleus.get(leadership.nucleusId) ?? {
      engaged: 0,
      toApproach: 0,
      disputed: 0,
    }
    const countKey = nucleusCountKeys[leadership.supportStatus]
    if (countKey !== null) counts[countKey] += 1
    countsByNucleus.set(leadership.nucleusId, counts)
  }

  return { supportCounts, countsByNucleus }
}

const coordinatorContacts = (
  coordinators: DashboardNucleusRecord['coordinators'],
): LeadershipDashboardCard['coordinators'] =>
  coordinators.map(({ name, phone }) => ({ name, phone }))

export const buildGeneralDashboardViewModel = (
  nuclei: DashboardNucleusRecord[],
  leaderships: DashboardLeadershipRecord[],
  updatesThisWeek: number,
  now: Date,
  upcomingActionPlans: ActionPlanUpcomingPreviewRecord[],
): GeneralDashboardViewModel => {
  const coordinatedCount = nuclei.filter(({ coordinators }) => coordinators.length > 0).length
  const confirmedCount = nuclei.filter(
    ({ confirmedVoteEstimate }) => confirmedVoteEstimate !== null,
  ).length
  const { supportCounts } = aggregateLeaderships(leaderships)

  return {
    role: 'geral',
    kpis: {
      activeNuclei: nuclei.length,
      coordinatorCoveragePercent: percentage(coordinatedCount, nuclei.length),
      confirmedVoteEstimateTotal: nuclei.reduce(
        (sum, nucleus) => sum + (nucleus.confirmedVoteEstimate ?? 0),
        0,
      ),
      confirmedEstimatePercent: percentage(confirmedCount, nuclei.length),
      regularVoteGoalTotal: sumVoteGoals(nuclei).regular,
      updatesThisWeek,
    },
    supportCounts,
    queues: {
      withoutCoordinator: nuclei
        .filter(({ coordinators }) => coordinators.length === 0)
        .map(toQueueItem),
      withoutRecentUpdate: nuclei
        .filter(({ lastUpdateAt }) => isOverdue(lastUpdateAt, now))
        .map(toQueueItem),
      pendingEstimate: nuclei
        .filter(
          ({ confirmedVoteEstimate, proposedVoteEstimate }) =>
            confirmedVoteEstimate === null || proposedVoteEstimate !== null,
        )
        .map(toQueueItem),
    },
    upcomingActionPlans,
  }
}

export const buildScopedDashboardViewModel = (
  role: Exclude<CampaignUser['role'], 'geral'>,
  nuclei: DashboardNucleusRecord[],
  leaderships: DashboardLeadershipRecord[],
  now: Date,
  upcomingActionPlans: ActionPlanUpcomingPreviewRecord[],
): ScopedDashboardViewModel => {
  if (role === 'lideranca') {
    return {
      role,
      cards: nuclei.map((nucleus) => ({
        id: nucleus.id,
        slug: nucleus.slug,
        name: nucleus.name,
        territory: territoryLabel(nucleus),
        organization: organizationLabel(nucleus),
        tseZones: nucleus.tseZones,
        confirmedVoteEstimate: nucleus.confirmedVoteEstimate,
        coordinators: coordinatorContacts(nucleus.coordinators),
      })),
      upcomingActionPlans,
    }
  }
  const { countsByNucleus } = aggregateLeaderships(leaderships)

  return {
    role,
    cards: nuclei.map((nucleus) => ({
      id: nucleus.id,
      slug: nucleus.slug,
      name: nucleus.name,
      territory: territoryLabel(nucleus),
      organization: organizationLabel(nucleus),
      tseZones: nucleus.tseZones,
      confirmedVoteEstimate: nucleus.confirmedVoteEstimate,
      hasPendingEstimate: nucleus.proposedVoteEstimate !== null,
      lastUpdateAt: nucleus.lastUpdateAt,
      isUpdateOverdue: isOverdue(nucleus.lastUpdateAt, now),
      leadershipCounts: countsByNucleus.get(nucleus.id) ?? {
        engaged: 0,
        toApproach: 0,
        disputed: 0,
      },
    })),
    upcomingActionPlans,
  }
}
