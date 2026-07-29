import 'server-only'

import type { Payload } from 'payload'

import type { AccessibleMunicipality } from '@/lib/municipalityProximity'
import { relationshipId, requireRelationshipId } from '@/lib/relationship'
import type { VoteEstimateScenario } from '@/lib/voteEstimate'
import type { CampaignUser, VotePledge } from '@/payload-types'
import {
  pickDashboardPriorityMunicipalities,
  type DashboardPriorityMunicipality,
} from '@/utilities/dashboardPriorityMunicipalities'
import {
  loadCampaignUserNamesByIds,
  loadLeadershipContactNamesByIds,
} from '@/utilities/loadNamesByIds'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'
import type { MunicipalityGoalCoverage } from '@/utilities/municipality/goalCoverage'
import {
  loadMunicipalityGoalCoverageBundle,
  loadStatewideSuggestedGoals,
  type MunicipalityGoalCoverageBundle,
} from '@/utilities/municipality/municipalityGoalAccount'
import {
  rollupMunicipalityStaffVotes,
  type MunicipalityPledgeAggregate,
} from '@/utilities/votePledgeViews'

export type StaffDashboardView = {
  kind: 'staff'
  role: 'coordinator' | 'advisor' | 'candidate'
  municipalityCount: number
  withAdvisorCount: number
  highPriorityCount: number
  staffVoteTotalByScenario: Record<VoteEstimateScenario, number>
  declaredVotesTotal: number
  pledgeCount: number
  missingEstimateCount: number
  /** E8 "conta da cadeira" — meta × comprometido, cenário central (dashboard não tem seletor de cenário). */
  goalCoverage: MunicipalityGoalCoverage
  missingEstimates: Array<{
    pledgeID: number
    municipalityName: string
    municipalitySlug: string
    contactName: string
    declaredVotes: number
  }>
  priorityMunicipalities: DashboardPriorityMunicipality[]
  /**
   * B14 — every município the actor can open, for the geo shortcut to match a
   * browser position against without sending the position anywhere. Minimal by
   * design: three short strings per row, so the whole catalog stays a few KB of
   * RSC payload.
   */
  accessibleMunicipalities: AccessibleMunicipality[]
  recentUpdates: Array<{
    id: number
    municipalityName: string
    municipalitySlug: string
    authorName: string
    createdAt: string
  }>
}

type ScopedMunicipalityDoc = Awaited<
  ReturnType<typeof loadMunicipalityScope>
>['municipalities'][number]

const loadStaffRollupAndGoalCoverageBundle = async (
  payload: Payload,
  user: CampaignUser,
  municipalities: ReadonlyArray<ScopedMunicipalityDoc>,
  pledgeAggregates: Map<number, MunicipalityPledgeAggregate>,
): Promise<{
  rollup: ReturnType<typeof rollupMunicipalityStaffVotes>
  goalCoverageBundle: MunicipalityGoalCoverageBundle
}> => {
  const goalCoverageBundle = await loadMunicipalityGoalCoverageBundle(
    payload,
    user,
    municipalities,
    pledgeAggregates,
  )
  const rollup = rollupMunicipalityStaffVotes(municipalities, pledgeAggregates)
  return { rollup, goalCoverageBundle }
}

/**
 * Staff dashboard data. Leaders never reach the dashboard — they are routed to
 * the supporter contact tool before this is called (see `/campanha` page).
 */
export const getCampaignDashboardData = async (
  payload: Payload,
  user: CampaignUser,
): Promise<StaffDashboardView> => {
  // Request-scoped shared load — the map bundle on the same page reuses it.
  const scope = await loadMunicipalityScope(payload, user, {})
  const municipalities = { docs: scope.municipalities }
  const pledgeAggregates = scope.pledgeAggregates
  const municipalityIDs = municipalities.docs.map((municipality) => municipality.id)
  const municipalityById = new Map(
    municipalities.docs.map((municipality) => [municipality.id, municipality]),
  )

  // Independent of each other — only depend on municipalityIDs.
  const [missingEstimatePledges, recentUpdatesResult] = await Promise.all([
    municipalityIDs.length
      ? payload.find({
          collection: 'votePledge',
          where: {
            and: [
              { municipality: { in: municipalityIDs } },
              { 'estimatedVotes.pessimistic': { equals: null } },
              { 'estimatedVotes.central': { equals: null } },
              { 'estimatedVotes.optimistic': { equals: null } },
            ],
          },
          depth: 0,
          limit: 5,
          pagination: false,
          sort: '-declaredVotes',
          select: { municipality: true, leadership: true, declaredVotes: true },
          // Intentional admin bypass: `municipalityIDs` came from the actor's
          // own access-checked scope read above; the queue needs pledge rows
          // even where the actor's votePledge row access is narrower.
          overrideAccess: true,
        })
      : Promise.resolve({ docs: [] as VotePledge[] }),
    municipalityIDs.length
      ? payload.find({
          collection: 'municipalityUpdate',
          where: { municipality: { in: municipalityIDs } },
          depth: 0,
          limit: 3,
          pagination: false,
          sort: '-createdAt',
          select: { municipality: true, author: true, createdAt: true },
          user,
          overrideAccess: false,
        })
      : Promise.resolve({ docs: [] }),
    // Result discarded on purpose: the goal-coverage bundle below reads
    // `campaignGoals` through the same `cache()`, so starting it here keeps the
    // global read off the tail of the request.
    loadStatewideSuggestedGoals(payload, user),
  ])

  const { rollup, goalCoverageBundle } = await loadStaffRollupAndGoalCoverageBundle(
    payload,
    user,
    municipalities.docs,
    pledgeAggregates,
  )
  const { staffVoteTotalByScenario, declaredVotesTotal, pledgeCount, missingEstimateCount } = rollup

  const leadershipIDs = [
    ...new Set(
      missingEstimatePledges.docs.map((pledge) => requireRelationshipId(pledge.leadership)),
    ),
  ]
  const authorIDs = [
    ...new Set(
      recentUpdatesResult.docs
        .map((update) => relationshipId(update.author))
        .filter((id): id is number => id !== null),
    ),
  ]

  const [contactNameByLeadershipId, authorNameById] = await Promise.all([
    loadLeadershipContactNamesByIds(payload, leadershipIDs),
    loadCampaignUserNamesByIds(payload, authorIDs),
  ])

  const dashboardPriority = pickDashboardPriorityMunicipalities(
    municipalities.docs,
    goalCoverageBundle.coverageByMunicipalityID,
  )

  const accessibleMunicipalities: AccessibleMunicipality[] = municipalities.docs.map(
    ({ slug, name, ibgeCode }) => ({ slug, name, ibgeCode }),
  )

  return {
    kind: 'staff',
    role:
      user.role === 'advisor' ? 'advisor' : user.role === 'candidate' ? 'candidate' : 'coordinator',
    municipalityCount: municipalities.docs.length,
    withAdvisorCount: municipalities.docs.filter(
      (municipality) => (municipality.advisors ?? []).length > 0,
    ).length,
    staffVoteTotalByScenario: { ...staffVoteTotalByScenario },
    declaredVotesTotal,
    pledgeCount,
    missingEstimateCount,
    goalCoverage: goalCoverageBundle.aggregateByScenario.central,
    missingEstimates: missingEstimatePledges.docs.map((pledge) => {
      const municipality = municipalityById.get(requireRelationshipId(pledge.municipality))
      const contactName =
        contactNameByLeadershipId.get(requireRelationshipId(pledge.leadership)) ?? 'Contato'
      return {
        pledgeID: pledge.id,
        municipalityName: municipality?.name ?? 'Município',
        municipalitySlug: municipality?.slug ?? '',
        contactName,
        declaredVotes: pledge.declaredVotes,
      }
    }),
    highPriorityCount: dashboardPriority.highPriorityCount,
    priorityMunicipalities: dashboardPriority.municipalities,
    accessibleMunicipalities,
    recentUpdates: recentUpdatesResult.docs.map((update) => {
      const municipality = municipalityById.get(relationshipId(update.municipality) ?? -1)
      return {
        id: update.id,
        municipalityName: municipality?.name ?? 'Município',
        municipalitySlug: municipality?.slug ?? '',
        authorName: authorNameById.get(relationshipId(update.author) ?? -1) ?? 'Usuário',
        createdAt: update.createdAt,
      }
    }),
  }
}

/** Staff Início: central staff vote total + E8 aggregate coverage (Quadro KPI contract). */
export type CampaignHomeSummaryView = Pick<StaffDashboardView, 'goalCoverage'> & {
  staffVoteTotalCentral: StaffDashboardView['staffVoteTotalByScenario']['central']
}

/** Slim loader for `/campanha` — scope + rollup + coverage only (no map, suggestions, or queues). */
export const loadCampaignHomeSummary = async (
  payload: Payload,
  user: CampaignUser,
): Promise<CampaignHomeSummaryView> => {
  const scope = await loadMunicipalityScope(payload, user, {})
  const { rollup, goalCoverageBundle } = await loadStaffRollupAndGoalCoverageBundle(
    payload,
    user,
    scope.municipalities,
    scope.pledgeAggregates,
  )

  return {
    staffVoteTotalCentral: rollup.staffVoteTotalByScenario.central,
    goalCoverage: goalCoverageBundle.aggregateByScenario.central,
  }
}
