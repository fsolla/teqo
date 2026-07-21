import type { Payload } from 'payload'

import type { CampaignUser, VotePledge } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { relationshipId, requireRelationshipId } from '@/utilities/relationship'
import {
  aggregatePledgesByPlaza,
  loadLeaderPledges,
  rollupPlazaStaffVotes,
  type LeaderPledgeRow,
} from '@/utilities/votePledgeData'

export type StaffDashboardView = {
  kind: 'staff'
  role: 'coordinator' | 'advisor'
  plazaCount: number
  withAdvisorCount: number
  highPriorityCount: number
  staffVoteTotal: number
  declaredVotesTotal: number
  pledgeCount: number
  missingEstimateCount: number
  missingEstimates: Array<{
    pledgeID: number
    plazaName: string
    plazaSlug: string
    contactName: string
    declaredVotes: number
  }>
  priorityPlazas: Array<{ name: string; slug: string }>
  recentUpdates: Array<{
    id: number
    plazaName: string
    plazaSlug: string
    authorName: string
    createdAt: string
  }>
}

export type LeaderDashboardView = {
  kind: 'leader'
  plazas: Array<{
    id: number
    name: string
    slug: string
    declaredVotes: number | null
  }>
}

export type CampaignDashboardView = StaffDashboardView | LeaderDashboardView

const resolveNames = async (
  payload: Payload,
  collection: 'plaza' | 'campaignUser' | 'leadership',
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

const buildStaffDashboard = async (
  payload: Payload,
  user: CampaignUser,
): Promise<StaffDashboardView> => {
  const plazas = await payload.find({
    collection: 'plaza',
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true, slug: true, advisors: true, priority: true, expectedVotes: true },
    where: {},
    user,
    overrideAccess: false,
  })
  const plazaIDs = plazas.docs.map((plaza) => plaza.id)
  const plazaById = new Map(plazas.docs.map((plaza) => [plaza.id, plaza]))

  const pledgeAggregates = await aggregatePledgesByPlaza(payload, plazaIDs)
  const {
    staffVoteTotal,
    declaredVotesTotal,
    pledgeCount,
    missingEstimateCount,
  } = rollupPlazaStaffVotes(plazas.docs, pledgeAggregates)

  const missingEstimatePledges = plazaIDs.length
    ? await payload.find({
        collection: 'votePledge',
        where: {
          and: [{ plaza: { in: plazaIDs } }, { estimatedVotes: { exists: false } }],
        },
        depth: 0,
        limit: 5,
        pagination: false,
        sort: '-declaredVotes',
        select: { plaza: true, leadership: true, declaredVotes: true },
        overrideAccess: true,
      })
    : { docs: [] as VotePledge[] }

  const leadershipIDs = [
    ...new Set(
      missingEstimatePledges.docs.map((pledge) => requireRelationshipId(pledge.leadership)),
    ),
  ]
  const leadershipsById = await resolveNames(payload, 'leadership', leadershipIDs, {
    contact: true,
  })

  const recentUpdatesResult = plazaIDs.length
    ? await payload.find({
        collection: 'plazaUpdate',
        where: { plaza: { in: plazaIDs } },
        depth: 0,
        limit: 3,
        pagination: false,
        sort: '-createdAt',
        select: { plaza: true, author: true, createdAt: true },
        user,
        overrideAccess: false,
      })
    : { docs: [] }

  const authorIDs = [
    ...new Set(
      recentUpdatesResult.docs
        .map((update) => relationshipId(update.author))
        .filter((id): id is number => id !== null),
    ),
  ]
  const authorsById = await resolveNames(payload, 'campaignUser', authorIDs, { name: true })

  return {
    kind: 'staff',
    role: user.role === 'coordinator' ? 'coordinator' : 'advisor',
    plazaCount: plazas.docs.length,
    withAdvisorCount: plazas.docs.filter((plaza) => (plaza.advisors ?? []).length > 0).length,
    highPriorityCount: plazas.docs.filter((plaza) => plaza.priority === 'alta').length,
    staffVoteTotal,
    declaredVotesTotal,
    pledgeCount,
    missingEstimateCount,
    missingEstimates: missingEstimatePledges.docs.map((pledge) => {
      const plaza = plazaById.get(requireRelationshipId(pledge.plaza))
      const leadership = leadershipsById.get(requireRelationshipId(pledge.leadership))
      const contact = leadership?.contact
      const contactName =
        typeof contact === 'object' && contact !== null && 'name' in contact
          ? String((contact as { name?: string }).name ?? 'Contato')
          : 'Contato'
      return {
        pledgeID: pledge.id,
        plazaName: plaza?.name ?? 'Praça',
        plazaSlug: plaza?.slug ?? '',
        contactName,
        declaredVotes: pledge.declaredVotes,
      }
    }),
    priorityPlazas: plazas.docs
      .filter((plaza) => plaza.priority === 'alta')
      .slice(0, 6)
      .map((plaza) => ({ name: plaza.name, slug: plaza.slug })),
    recentUpdates: recentUpdatesResult.docs.map((update) => {
      const plaza = plazaById.get(relationshipId(update.plaza) ?? -1)
      const author = authorsById.get(relationshipId(update.author) ?? -1)
      return {
        id: update.id,
        plazaName: plaza?.name ?? 'Praça',
        plazaSlug: plaza?.slug ?? '',
        authorName: String(author?.name ?? 'Usuário'),
        createdAt: update.createdAt,
      }
    }),
  }
}

const buildLeaderDashboard = async (
  payload: Payload,
  user: CampaignUser,
): Promise<LeaderDashboardView> => {
  const plazas = await payload.find({
    collection: 'plaza',
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true, slug: true },
    where: {},
    user,
    overrideAccess: false,
  })
  const pledges: LeaderPledgeRow[] = await loadLeaderPledges(payload, user)
  const pledgeByPlaza = new Map(pledges.map((pledge) => [pledge.plazaID, pledge]))

  return {
    kind: 'leader',
    plazas: plazas.docs.map((plaza) => ({
      id: plaza.id,
      name: plaza.name,
      slug: plaza.slug,
      declaredVotes: pledgeByPlaza.get(plaza.id)?.declaredVotes ?? null,
    })),
  }
}

export const getCampaignDashboardData = async (
  payload: Payload,
  user: CampaignUser,
): Promise<CampaignDashboardView> =>
  isCampaignStaff(user) ? buildStaffDashboard(payload, user) : buildLeaderDashboard(payload, user)
