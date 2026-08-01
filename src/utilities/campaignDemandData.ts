import 'server-only'

import type { Payload } from 'payload'

import { isPopulatedRelationship, relationshipId } from '@/lib/relationship'
import type { CampaignDemandKind, CampaignDemandStatus } from '@/lib/schemas/campaignDemand'
import { campaignDemandKinds, campaignDemandStatuses } from '@/lib/schemas/campaignDemand'
import type { Activity, CampaignDemand, CampaignUser } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import {
  buildListHref,
  firstValue,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'
import {
  loadCampaignUserNamesByIds,
  loadLeadershipContactNamesByIds,
  loadMunicipalityLabelsByIds,
} from '@/utilities/loadNamesByIds'

const demandPageSize = 25

export type DemandRowViewModel = {
  id: number
  title: string
  slug: string
  kind: CampaignDemandKind
  status: CampaignDemandStatus
  municipalityId: number
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

export const parseDemandListParams = (searchParams: RawSearchParams): DemandListState => {
  const rawStatus = firstValue(searchParams.status)
  const rawKind = firstValue(searchParams.kind)

  return {
    page: strictDecimalInteger(firstValue(searchParams.page)) ?? 1,
    ...(campaignDemandStatuses.includes(rawStatus as CampaignDemandStatus)
      ? { status: rawStatus as CampaignDemandStatus }
      : {}),
    ...(campaignDemandKinds.includes(rawKind as CampaignDemandKind)
      ? { kind: rawKind as CampaignDemandKind }
      : {}),
  }
}

const buildDemandListSearchParams = (
  state: DemandListState,
  page = state.page,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.status) params.set('status', state.status)
  if (state.kind) params.set('kind', state.kind)
  if (page > 1) params.set('page', String(page))
  return params
}

export const buildDemandListHref = (state: DemandListState, page: number): string =>
  buildListHref(state, buildDemandListSearchParams, '/campanha/demandas', page)

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

  const [municipalityBy, contactNameByLeadershipId] = await Promise.all([
    loadMunicipalityLabelsByIds(payload, municipalityIDs),
    loadLeadershipContactNamesByIds(payload, leadershipIDs),
  ])

  return {
    municipalityBy,
    requesterBy: contactNameByLeadershipId,
  }
}

const toDemandRow = (
  demand: CampaignDemand,
  municipalityBy: Map<number, { name: string; slug: string }>,
  requesterBy: Map<number, string>,
): DemandRowViewModel => {
  const municipality = municipalityBy.get(relationshipId(demand.municipality) ?? -1)
  const municipalityID = relationshipId(demand.municipality)
  const leadershipID = relationshipId(demand.leadership)
  return {
    id: demand.id,
    title: demand.title,
    slug: demand.slug,
    kind: demand.kind as CampaignDemandKind,
    status: demand.status as CampaignDemandStatus,
    municipalityId: municipalityID ?? 0,
    municipalityName: municipality?.name ?? 'Município',
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
  activity: { title: string; slug: string } | null
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
  const authorNameById = await loadCampaignUserNamesByIds(payload, authorIDs)

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
    activity: isPopulatedRelationship<Activity>(demand.activity)
      ? { title: demand.activity.title, slug: demand.activity.slug }
      : null,
  }
}
