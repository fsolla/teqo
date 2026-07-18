import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { isSupportStatus } from '@/lib/schemas/leadership'
import { loadUpcomingActionPlansPreview } from '@/utilities/actionPlanUpcomingPreview'
import { getBahiaWeekRange } from '@/utilities/campaignTime'
import { loadCoordinatorSummaries } from '@/utilities/nucleusCoordinatorOptions'
import {
  buildGeneralDashboardViewModel,
  buildScopedDashboardViewModel,
  type DashboardLeadershipRecord,
  type DashboardNucleusRecord,
} from '@/utilities/campaignDashboardViewModels'
import { requireRelationshipId } from '@/utilities/relationship'

const dashboardStaffNucleusSelect = {
  name: true,
  slug: true,
  regions: true,
  cities: true,
  neighborhoods: true,
  locality: true,
  organizationKind: true,
  organizationLabel: true,
  coordinators: true,
  tseZones: { zoneNumber: true },
  confirmedVoteEstimate: true,
  proposedVoteEstimate: true,
  lastUpdateAt: true,
} as const

const dashboardLeadershipNucleusSelect = {
  name: true,
  slug: true,
  regions: true,
  cities: true,
  neighborhoods: true,
  locality: true,
  organizationKind: true,
  organizationLabel: true,
  coordinators: true,
  tseZones: { zoneNumber: true },
  confirmedVoteEstimate: true,
} as const

const dashboardLeadershipSelect = {
  nucleus: true,
  supportStatus: true,
} as const

type RawDashboardNucleus = {
  id: number
  name: string
  slug: string
  regions?: string[] | null
  cities?: string[] | null
  neighborhoods?: string[] | null
  locality?: string | null
  organizationKind: DashboardNucleusRecord['organizationKind']
  organizationLabel?: string | null
  coordinators?: Array<number | { id: number }>
  tseZones?: Array<{ zoneNumber: number }>
  confirmedVoteEstimate?: number | null
  proposedVoteEstimate?: number | null
  lastUpdateAt?: string | null
}

const asStringArray = (value: string[] | null | undefined): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

type RawDashboardLeadership = {
  nucleus: number | { id: number }
  supportStatus?: unknown
}

const toDashboardNucleusRecord = (
  nucleus: RawDashboardNucleus,
  coordinatorIdentities: Map<number, { name: string; phone: string | null }>,
): DashboardNucleusRecord => ({
  id: nucleus.id,
  name: nucleus.name,
  slug: nucleus.slug,
  regions: asStringArray(nucleus.regions),
  cities: asStringArray(nucleus.cities),
  neighborhoods: asStringArray(nucleus.neighborhoods),
  locality: nucleus.locality ?? null,
  organizationKind: nucleus.organizationKind,
  organizationLabel: nucleus.organizationLabel ?? null,
  coordinators: (nucleus.coordinators ?? []).flatMap((coordinator) => {
    const id = requireRelationshipId(coordinator)
    const identity = coordinatorIdentities.get(id)
    return identity ? [{ id, ...identity }] : []
  }),
  tseZones: nucleus.tseZones?.map(({ zoneNumber }) => zoneNumber) ?? [],
  confirmedVoteEstimate: nucleus.confirmedVoteEstimate ?? null,
  proposedVoteEstimate: nucleus.proposedVoteEstimate ?? null,
  lastUpdateAt: nucleus.lastUpdateAt ?? null,
})

export const getCampaignDashboardPageData = async (
  payload: Payload,
  user: CampaignUser,
  now = new Date(),
) => {
  const week = getBahiaWeekRange(now)
  const [nucleusResult, leadershipResult, updateResult, upcomingActionPlans] = await Promise.all([
    payload.find({
      collection: 'electoralNucleus',
      where: { status: { equals: 'ativo' } },
      depth: 0,
      pagination: false,
      sort: 'name',
      select:
        user.role === 'lideranca' ? dashboardLeadershipNucleusSelect : dashboardStaffNucleusSelect,
      user,
      overrideAccess: false,
    }),
    user.role === 'lideranca'
      ? Promise.resolve({ docs: [] })
      : payload.find({
          collection: 'leadership',
          where: { 'nucleus.status': { equals: 'ativo' } },
          depth: 0,
          pagination: false,
          select: dashboardLeadershipSelect,
          user,
          overrideAccess: false,
        }),
    user.role === 'geral'
      ? payload.find({
          collection: 'nucleusUpdate',
          where: {
            and: [
              { 'nucleus.status': { equals: 'ativo' } },
              { createdAt: { greater_than_equal: week.start.toISOString() } },
              { createdAt: { less_than: week.end.toISOString() } },
            ],
          },
          depth: 0,
          limit: 1,
          select: { createdAt: true },
          user,
          overrideAccess: false,
        })
      : Promise.resolve({ totalDocs: 0 }),
    loadUpcomingActionPlansPreview(payload, user, now),
  ])

  const rawNuclei = nucleusResult.docs as unknown as RawDashboardNucleus[]
  const coordinatorIds = [
    ...new Set(
      rawNuclei.flatMap((nucleus) =>
        (nucleus.coordinators ?? []).map((coordinator) => requireRelationshipId(coordinator)),
      ),
    ),
  ]
  const coordinatorSummaries = await loadCoordinatorSummaries(payload, user, coordinatorIds)
  const coordinatorIdentities = new Map(
    coordinatorSummaries.map((coordinator) => [
      coordinator.id,
      {
        name: coordinator.name,
        phone: coordinator.phone ?? null,
      },
    ]),
  )
  const nuclei = rawNuclei.map((nucleus) =>
    toDashboardNucleusRecord(nucleus, coordinatorIdentities),
  )
  const leaderships = (
    leadershipResult.docs as unknown as RawDashboardLeadership[]
  ).flatMap((leadership): DashboardLeadershipRecord[] => {
    // Payload omits fields denied by field-level read access. A missing status is
    // therefore an intentionally incomplete projection, not a domain value.
    if (leadership.supportStatus === undefined) return []
    if (!isSupportStatus(leadership.supportStatus)) {
      throw new Error('Dashboard leadership support status invariant violated.')
    }

    return [
      {
        nucleusId: requireRelationshipId(leadership.nucleus),
        supportStatus: leadership.supportStatus,
      },
    ]
  })

  if (user.role === 'geral') {
    return buildGeneralDashboardViewModel(
      nuclei,
      leaderships,
      updateResult.totalDocs,
      now,
      upcomingActionPlans,
    )
  }

  return buildScopedDashboardViewModel(user.role, nuclei, leaderships, now, upcomingActionPlans)
}
