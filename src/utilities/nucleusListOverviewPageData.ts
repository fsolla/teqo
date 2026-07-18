import type { Payload } from 'payload'

import type { CampaignUser, NucleusUpdate } from '@/payload-types'
import {
  buildNucleusListOverviewViewModel,
  nucleusListOverviewPreviewLimit,
  type NucleusListOverviewNucleusRecord,
  type NucleusListOverviewUpdateRecord,
  type NucleusListOverviewViewModel,
} from '@/utilities/nucleusListOverviewViewModels'
import { buildNucleusListWhere, type NucleusListState } from '@/utilities/nucleusUi'
import { requireRelationshipId } from '@/utilities/relationship'

const overviewStaffNucleusSelect = {
  slug: true,
  name: true,
  coordinators: true,
  confirmedVoteEstimate: true,
  proposedVoteEstimate: true,
} as const

const overviewLeadershipNucleusSelect = {
  slug: true,
  name: true,
  coordinators: true,
  confirmedVoteEstimate: true,
} as const

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
  confirmedVoteEstimate?: number | null
  proposedVoteEstimate?: number | null
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
): Promise<NucleusListOverviewViewModel | null> => {
  const nucleusResult = await payload.find({
    collection: 'electoralNucleus',
    where: buildNucleusListWhere(state),
    depth: 0,
    pagination: false,
    select:
      user.role === 'lideranca' ? overviewLeadershipNucleusSelect : overviewStaffNucleusSelect,
    user,
    overrideAccess: false,
  })

  const rawNuclei = nucleusResult.docs as unknown as RawOverviewNucleus[]
  if (rawNuclei.length === 0) return null

  const nuclei: NucleusListOverviewNucleusRecord[] = rawNuclei.map((nucleus) => ({
    id: nucleus.id,
    slug: nucleus.slug,
    name: nucleus.name,
    coordinators: nucleus.coordinators ?? [],
    confirmedVoteEstimate: nucleus.confirmedVoteEstimate ?? null,
    proposedVoteEstimate: nucleus.proposedVoteEstimate ?? null,
  }))

  const nucleiById = new Map(nuclei.map((nucleus) => [nucleus.id, nucleus]))
  const updateResult = await payload.find({
    collection: 'nucleusUpdate',
    where: { nucleus: { in: nuclei.map(({ id }) => id) } },
    depth: 0,
    limit: nucleusListOverviewPreviewLimit,
    page: 1,
    sort: '-createdAt',
    select: overviewUpdateSelect,
    user,
    overrideAccess: false,
  })

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
  })
}
