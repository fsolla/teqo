import type { Payload } from 'payload'

import type { CampaignDemandKind, CampaignDemandStatus } from '@/lib/schemas/campaignDemand'
import { campaignDemandKinds, campaignDemandStatuses } from '@/lib/schemas/campaignDemand'
import type { ActionPlan, CampaignDemand, CampaignUser } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { isPopulatedRelationship, relationshipId } from '@/utilities/relationship'

export const demandPageSize = 25

export type DemandRowViewModel = {
  id: number
  title: string
  slug: string
  kind: CampaignDemandKind
  status: CampaignDemandStatus
  municipalityName: string
  municipalitySlug: string
  requesterName: string | null
  createdAt: string
}

export type DemandListState = {
  page: number
  status?: CampaignDemandStatus
  kind?: CampaignDemandKind
}

export const parseDemandListParams = (
  searchParams: Record<string, string | string[] | undefined>,
): DemandListState => {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const rawStatus = first(searchParams.status)
  const rawKind = first(searchParams.kind)
  const rawPage = first(searchParams.page)

  return {
    page: rawPage && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1,
    ...(campaignDemandStatuses.includes(rawStatus as CampaignDemandStatus)
      ? { status: rawStatus as CampaignDemandStatus }
      : {}),
    ...(campaignDemandKinds.includes(rawKind as CampaignDemandKind)
      ? { kind: rawKind as CampaignDemandKind }
      : {}),
  }
}

const resolveMunicipalityAndRequesterNames = async (
  payload: Payload,
  demands: CampaignDemand[],
): Promise<{
  municipalityBy: Map<number, { name: string; slug: string }>
  requesterBy: Map<number, string>
}> => {
  const municipalityIDs = [
    ...new Set(
      demands
        .map((demand) => relationshipId(demand.municipality))
        .filter((id): id is number => id !== null),
    ),
  ]
  const leadershipIDs = [
    ...new Set(
      demands
        .map((demand) => relationshipId(demand.leadership))
        .filter((id): id is number => id !== null),
    ),
  ]

  const [municipalities, leaderships] = await Promise.all([
    municipalityIDs.length
      ? payload.find({
          collection: 'municipality',
          where: { id: { in: municipalityIDs } },
          depth: 0,
          limit: 0,
          pagination: false,
          select: { name: true, slug: true },
          overrideAccess: true,
        })
      : { docs: [] },
    leadershipIDs.length
      ? payload.find({
          collection: 'leadership',
          where: { id: { in: leadershipIDs } },
          depth: 1,
          limit: 0,
          pagination: false,
          select: { contact: true },
          overrideAccess: true,
        })
      : { docs: [] },
  ])

  return {
    municipalityBy: new Map(
      municipalities.docs.map((municipality) => [
        municipality.id,
        { name: municipality.name, slug: municipality.slug },
      ]),
    ),
    requesterBy: new Map(
      leaderships.docs.map((leadership) => {
        const contact = leadership.contact
        return [
          leadership.id,
          typeof contact === 'object' && contact !== null && 'name' in contact
            ? String(contact.name)
            : 'Liderança',
        ]
      }),
    ),
  }
}

const toDemandRow = (
  demand: CampaignDemand,
  municipalityBy: Map<number, { name: string; slug: string }>,
  requesterBy: Map<number, string>,
): DemandRowViewModel => {
  const municipality = municipalityBy.get(relationshipId(demand.municipality) ?? -1)
  const leadershipID = relationshipId(demand.leadership)
  return {
    id: demand.id,
    title: demand.title,
    slug: demand.slug,
    kind: demand.kind as CampaignDemandKind,
    status: demand.status as CampaignDemandStatus,
    municipalityName: municipality?.name ?? 'Praça',
    municipalitySlug: municipality?.slug ?? '',
    requesterName: leadershipID ? (requesterBy.get(leadershipID) ?? null) : null,
    createdAt: demand.createdAt,
  }
}

export const loadDemandListPageData = async (
  payload: Payload,
  user: CampaignUser,
  state: DemandListState,
): Promise<{
  rows: DemandRowViewModel[]
  totalDocs: number
  totalPages: number
  openCount: number
}> => {
  const [result, openCount] = await Promise.all([
    payload.find({
      collection: 'campaignDemand',
      where: {
        and: [
          ...(state.status ? [{ status: { equals: state.status } }] : []),
          ...(state.kind ? [{ kind: { equals: state.kind } }] : []),
        ],
      },
      depth: 0,
      limit: demandPageSize,
      page: state.page,
      sort: '-createdAt',
      user,
      overrideAccess: false,
    }),
    payload.count({
      collection: 'campaignDemand',
      where: { status: { in: ['aberta', 'em_analise', 'escalada'] } },
      user,
      overrideAccess: false,
    }),
  ])

  const { municipalityBy, requesterBy } = await resolveMunicipalityAndRequesterNames(
    payload,
    result.docs as CampaignDemand[],
  )

  return {
    rows: (result.docs as CampaignDemand[]).map((demand) =>
      toDemandRow(demand, municipalityBy, requesterBy),
    ),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    openCount: openCount.totalDocs,
  }
}

export type DemandDetailViewModel = DemandRowViewModel & {
  description: string | null
  decisionNote: string | null
  decidedAt: string | null
  /** Staff-only (field access strips for leaders). */
  cost: number | null
  receipts: Array<{ id: number; url: string | null; filename: string | null }>
  statusHistory: Array<{
    status: CampaignDemandStatus
    note: string | null
    authorName: string | null
    createdAt: string | null
  }>
  canLeaderEdit: boolean
  actionPlan: { title: string; slug: string } | null
}

export const loadDemandDetail = async (
  payload: Payload,
  user: CampaignUser,
  slug: string,
): Promise<DemandDetailViewModel | null> => {
  const result = await payload.find({
    collection: 'campaignDemand',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const demand = result.docs[0] as CampaignDemand | undefined
  if (!demand) return null

  const { municipalityBy, requesterBy } = await resolveMunicipalityAndRequesterNames(payload, [
    demand,
  ])
  const row = toDemandRow(demand, municipalityBy, requesterBy)

  const authorIDs = [
    ...new Set(
      (demand.statusHistory ?? [])
        .map((entry) => relationshipId(entry.author))
        .filter((id): id is number => id !== null),
    ),
  ]
  const authors = authorIDs.length
    ? await payload.find({
        collection: 'campaignUser',
        where: { id: { in: authorIDs } },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { name: true },
        overrideAccess: true,
      })
    : { docs: [] }
  const authorNameById = new Map(authors.docs.map((author) => [author.id, author.name]))

  return {
    ...row,
    description: demand.description ?? null,
    decisionNote: demand.decisionNote ?? null,
    decidedAt: demand.decidedAt ?? null,
    cost: isCampaignStaff(user) ? (demand.cost ?? null) : null,
    receipts: isCampaignStaff(user)
      ? (demand.receipts ?? []).flatMap((receipt) =>
          typeof receipt === 'object' && receipt !== null
            ? [
                {
                  id: receipt.id,
                  url: receipt.url ?? null,
                  filename: receipt.filename ?? null,
                },
              ]
            : [],
        )
      : [],
    statusHistory: isCampaignStaff(user)
      ? (demand.statusHistory ?? []).map((entry) => ({
          status: entry.status as CampaignDemandStatus,
          note: entry.note ?? null,
          authorName: authorNameById.get(relationshipId(entry.author) ?? -1) ?? null,
          createdAt: entry.createdAt ?? null,
        }))
      : [],
    canLeaderEdit: user.role === 'leader' && demand.status === 'aberta',
    actionPlan: isPopulatedRelationship<ActionPlan>(demand.actionPlan)
      ? { title: demand.actionPlan.title, slug: demand.actionPlan.slug }
      : null,
  }
}
