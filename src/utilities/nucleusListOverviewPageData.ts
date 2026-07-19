import type { Payload } from 'payload'

import type { CampaignUser, NucleusUpdate } from '@/payload-types'
import { loadUpcomingActionPlansPreview } from '@/utilities/actionPlanUpcomingPreview'
import {
  loadNucleusListElectionOverview,
  toNucleusElectionGeographyInput,
} from '@/utilities/nucleusElectoralBaseline'
import {
  buildNucleusListOverviewViewModel,
  nucleusListOverviewPreviewLimit,
  type NucleusListOverviewNucleusRecord,
  type NucleusListOverviewUpdateRecord,
  type NucleusListOverviewViewModel,
} from '@/utilities/nucleusListOverviewViewModels'
import { buildNucleusListWhere, type NucleusListState } from '@/utilities/nucleusUi'
import { nucleusVoteGoalsSelect } from '@/utilities/nucleusViewModels'
import { requireRelationshipId } from '@/utilities/relationship'
import { toVoteGoalsViewModel } from '@/utilities/voteGoals'

const overviewNucleusSelectBase = {
  slug: true,
  name: true,
  coordinators: true,
  cities: true,
  regions: true,
  tseZones: { zoneNumber: true },
  confirmedVoteEstimate: true,
  ...nucleusVoteGoalsSelect,
} as const

const overviewStaffNucleusSelect = {
  ...overviewNucleusSelectBase,
  proposedVoteEstimate: true,
} as const

const overviewLeadershipNucleusSelect = overviewNucleusSelectBase

const overviewUpdateSelect = {
  author: true,
  kind: true,
  createdAt: true,
  nucleus: true,
} as const

type RawOverviewNucleus = {
  id: number
  slug: string
  name: string
  coordinators?: Array<number | { id: number }>
  cities?: string[] | null
  regions?: string[] | null
  tseZones?: Array<{ zoneNumber: number }> | null
  confirmedVoteEstimate?: number | null
  proposedVoteEstimate?: number | null
  voteGoals?: {
    good?: number | null
    regular?: number | null
    minimum?: number | null
  } | null
  priority?: NucleusListOverviewNucleusRecord['priority'] | null
}

type RawOverviewUpdate = {
  id: number
  author: number | { id: number }
  kind: NucleusUpdate['kind']
  createdAt: string
  nucleus: number | { id: number }
}

export const loadNucleusListOverviewData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  state: NucleusListState,
  now = new Date(),
): Promise<NucleusListOverviewViewModel | null> => {
  const upcomingFilters = {
    ...(state.region ? { region: state.region } : {}),
    ...(state.city ? { city: state.city } : {}),
  }

  const [nucleusResult, upcomingActionPlans] = await Promise.all([
    payload.find({
      collection: 'electoralNucleus',
      where: buildNucleusListWhere(state),
      depth: 0,
      pagination: false,
      select:
        user.role === 'lideranca' ? overviewLeadershipNucleusSelect : overviewStaffNucleusSelect,
      user,
      overrideAccess: false,
    }),
    loadUpcomingActionPlansPreview(payload, user, now, { filters: upcomingFilters }),
  ])

  const rawNuclei = nucleusResult.docs as unknown as RawOverviewNucleus[]
  if (rawNuclei.length === 0) return null

  const nuclei: NucleusListOverviewNucleusRecord[] = rawNuclei.map((nucleus) => {
    const geography = toNucleusElectionGeographyInput(nucleus)
    return {
      id: nucleus.id,
      slug: nucleus.slug,
      name: nucleus.name,
      coordinators: nucleus.coordinators ?? [],
      ...geography,
      confirmedVoteEstimate: nucleus.confirmedVoteEstimate ?? null,
      proposedVoteEstimate: nucleus.proposedVoteEstimate ?? null,
      voteGoals: toVoteGoalsViewModel(nucleus.voteGoals),
      priority: nucleus.priority ?? 'normal',
    }
  })

  const nucleiById = new Map(nuclei.map((nucleus) => [nucleus.id, nucleus]))
  const [updateResult, listElectionOverview] = await Promise.all([
    payload.find({
      collection: 'nucleusUpdate',
      where: { nucleus: { in: nuclei.map(({ id }) => id) } },
      depth: 0,
      limit: nucleusListOverviewPreviewLimit,
      page: 1,
      sort: '-createdAt',
      select: overviewUpdateSelect,
      user,
      overrideAccess: false,
    }),
    loadNucleusListElectionOverview(payload, user, nuclei),
  ])

  const updates = updateResult.docs as unknown as RawOverviewUpdate[]
  const authorIds = [...new Set(updates.map(({ author }) => requireRelationshipId(author)))]
  const authors =
    user.role === 'lideranca'
      ? [user]
      : authorIds.length === 0
        ? []
        : (
            await payload.find({
              collection: 'campaignUser',
              where: { id: { in: authorIds } },
              depth: 0,
              pagination: false,
              select: { name: true, role: true },
              user,
              overrideAccess: false,
            })
          ).docs

  const authorsById = new Map(authors.map((author) => [author.id, author.name]))

  const recentUpdates: NucleusListOverviewUpdateRecord[] = updates.flatMap((update) => {
    const authorName = authorsById.get(requireRelationshipId(update.author))
    const nucleus = nucleiById.get(requireRelationshipId(update.nucleus))
    if (!authorName || !nucleus) return []

    return [
      {
        id: update.id,
        nucleusSlug: nucleus.slug,
        nucleusName: nucleus.name,
        authorName,
        kind: update.kind,
        createdAt: update.createdAt,
      },
    ]
  })

  return buildNucleusListOverviewViewModel({
    nuclei,
    recentUpdates,
    role: user.role,
    upcomingActionPlans,
    baseline2022: listElectionOverview.baseline2022,
    trend: listElectionOverview.trend,
  })
}
