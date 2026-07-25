import 'server-only'

import type { Payload } from 'payload'

import type { CampaignUser, VotePledge } from '@/payload-types'
import { loadMunicipalityScope } from '@/utilities/campaignMunicipalityScope'
import type { MunicipalityGoalCoverage } from '@/utilities/goalCoverage'
import { loadMunicipalityGoalCoverageBundle } from '@/utilities/municipalityGoalAccount'
import { relationshipId, requireRelationshipId } from '@/utilities/relationship'
import type { VoteEstimateScenario } from '@/lib/voteEstimate'
import { rollupMunicipalityStaffVotes } from '@/utilities/votePledgeViews'

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
  priorityMunicipalities: Array<{ name: string; slug: string }>
  recentUpdates: Array<{
    id: number
    municipalityName: string
    municipalitySlug: string
    authorName: string
    createdAt: string
  }>
}

const resolveNames = async (
  payload: Payload,
  collection: 'municipality' | 'campaignUser' | 'leadership',
  ids: number[],
  select: Record<string, true>,
) => {
  if (ids.length === 0) return new Map<number, Record<string, unknown>>()
  const result = await payload.find({
    collection,
    where: { id: { in: ids } },
    depth: collection === 'leadership' ? 1 : 0,
    limit: 0,
    pagination: false,
    select,
    overrideAccess: true,
  })
  return new Map(result.docs.map((doc) => [doc.id, doc as unknown as Record<string, unknown>]))
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
  ])

  const rollup = rollupMunicipalityStaffVotes(municipalities.docs, pledgeAggregates)
  const { staffVoteTotalByScenario, declaredVotesTotal, pledgeCount, missingEstimateCount } = rollup

  const goalCoverageBundle = await loadMunicipalityGoalCoverageBundle(
    payload,
    user,
    municipalities.docs,
    pledgeAggregates,
  )

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

  const [leadershipsById, authorsById] = await Promise.all([
    resolveNames(payload, 'leadership', leadershipIDs, { contact: true }),
    resolveNames(payload, 'campaignUser', authorIDs, { name: true }),
  ])

  return {
    kind: 'staff',
    role:
      user.role === 'advisor' ? 'advisor' : user.role === 'candidate' ? 'candidate' : 'coordinator',
    municipalityCount: municipalities.docs.length,
    withAdvisorCount: municipalities.docs.filter(
      (municipality) => (municipality.advisors ?? []).length > 0,
    ).length,
    highPriorityCount: municipalities.docs.filter(
      (municipality) => municipality.priority === 'alta',
    ).length,
    staffVoteTotalByScenario: { ...staffVoteTotalByScenario },
    declaredVotesTotal,
    pledgeCount,
    missingEstimateCount,
    goalCoverage: goalCoverageBundle.aggregateByScenario.central,
    missingEstimates: missingEstimatePledges.docs.map((pledge) => {
      const municipality = municipalityById.get(requireRelationshipId(pledge.municipality))
      const leadership = leadershipsById.get(requireRelationshipId(pledge.leadership))
      const contact = leadership?.contact
      const contactName =
        typeof contact === 'object' && contact !== null && 'name' in contact
          ? String((contact as { name?: string }).name ?? 'Contato')
          : 'Contato'
      return {
        pledgeID: pledge.id,
        municipalityName: municipality?.name ?? 'Município',
        municipalitySlug: municipality?.slug ?? '',
        contactName,
        declaredVotes: pledge.declaredVotes,
      }
    }),
    priorityMunicipalities: municipalities.docs
      .filter((municipality) => municipality.priority === 'alta')
      .slice(0, 6)
      .map((municipality) => ({ name: municipality.name, slug: municipality.slug })),
    recentUpdates: recentUpdatesResult.docs.map((update) => {
      const municipality = municipalityById.get(relationshipId(update.municipality) ?? -1)
      const author = authorsById.get(relationshipId(update.author) ?? -1)
      return {
        id: update.id,
        municipalityName: municipality?.name ?? 'Município',
        municipalitySlug: municipality?.slug ?? '',
        authorName: String(author?.name ?? 'Usuário'),
        createdAt: update.createdAt,
      }
    }),
  }
}
