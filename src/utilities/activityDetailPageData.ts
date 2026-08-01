import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import type { Activity, CampaignDemand, CampaignUser } from '@/payload-types'
import type { ActivityDetailTab } from '@/utilities/activityDetailTabUi'
import type { AccessibleActivityContext } from '@/utilities/activityPageData'
import {
  activityMunicipalitySummary,
  toActivityDetailViewModel,
  type ActivityDetailViewModel,
  type ActivityMunicipalitySummary,
} from '@/utilities/activityViewModels'

export const ACTIVITY_LINKED_DEMANDS_PAGE_SIZE = 10

type ActivityDemandSummary = {
  id: number
  title: string
  slug: string
  kind: CampaignDemand['kind']
  status: CampaignDemand['status']
  cost: number | null
}

export type ActivityLinkedDemandsPage = {
  demands: ActivityDemandSummary[]
  page: number
  totalPages: number
  totalDocs: number
  demandCostTotal: number
}

const emptyLinkedDemandsPage = (): ActivityLinkedDemandsPage => ({
  demands: [],
  page: 1,
  totalPages: 1,
  totalDocs: 0,
  demandCostTotal: 0,
})

const loadActivityUpdateAuthorNames = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  updates: NonNullable<Activity['updates']>,
): Promise<Map<number, string>> => {
  const authorIds = [
    ...new Set(
      updates
        .map((update) => relationshipId(update.author))
        .filter((id): id is number => id !== null),
    ),
  ]

  if (authorIds.length === 0) return new Map()

  const result = await payload.find({
    collection: 'campaignUser',
    where: { id: { in: authorIds } },
    depth: 0,
    pagination: false,
    select: { name: true },
    user,
    overrideAccess: false,
  })

  return new Map(result.docs.map((author) => [author.id, author.name]))
}

/**
 * Display-name lookup for an activity's municipality when the document was loaded at
 * depth 0 (updates tab). The actor already passed row access on the activity
 * itself, so reading the municipality's name/slug privileged avoids a second
 * per-role access round-trip (established display-name pattern).
 */
const loadActivityMunicipalitySummaryById = async (
  payload: Pick<Payload, 'find'>,
  municipalityId: number,
): Promise<ActivityMunicipalitySummary | null> => {
  const result = await payload.find({
    collection: 'municipality',
    where: { id: { equals: municipalityId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { name: true, slug: true },
    overrideAccess: true,
  })
  const municipality = result.docs[0]
  return municipality
    ? { id: municipality.id, name: municipality.name, slug: municipality.slug }
    : null
}

const loadLinkedDemandsPage = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  activityId: number,
  page: number,
): Promise<ActivityLinkedDemandsPage> => {
  const where = { activity: { equals: activityId } }

  const [pageResult, costRows] = await Promise.all([
    payload.find({
      collection: 'campaignDemand',
      where,
      depth: 0,
      limit: ACTIVITY_LINKED_DEMANDS_PAGE_SIZE,
      page,
      sort: '-createdAt',
      select: { title: true, slug: true, kind: true, status: true, cost: true },
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'campaignDemand',
      where,
      depth: 0,
      limit: 0,
      pagination: false,
      select: { cost: true },
      user,
      overrideAccess: false,
    }),
  ])

  const demands = pageResult.docs.map((demand) => ({
    id: demand.id,
    title: demand.title,
    slug: demand.slug,
    kind: demand.kind,
    status: demand.status,
    cost: demand.cost ?? null,
  }))

  return {
    demands,
    page: pageResult.page ?? page,
    totalPages: pageResult.totalPages,
    totalDocs: pageResult.totalDocs,
    demandCostTotal: costRows.docs.reduce((total, demand) => total + (demand.cost ?? 0), 0),
  }
}

export const getActivityDetailPageData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  context: AccessibleActivityContext,
  activeTab: ActivityDetailTab,
  linkedDemandsPage = 1,
): Promise<ActivityDetailViewModel & ActivityLinkedDemandsPage> => {
  const municipalityId = relationshipId(context.document.municipality)
  const populatedMunicipalitySummary =
    activityMunicipalitySummary(context.document.municipality) ?? null
  const municipalitySummaryPromise = populatedMunicipalitySummary
    ? Promise.resolve(populatedMunicipalitySummary)
    : municipalityId
      ? loadActivityMunicipalitySummaryById(payload, municipalityId)
      : Promise.resolve(null)
  const authorNamesPromise =
    activeTab === 'updates' && context.document.updates?.length
      ? loadActivityUpdateAuthorNames(payload, user, context.document.updates)
      : Promise.resolve(new Map<number, string>())
  const linkedDemandsPromise =
    activeTab === 'overview'
      ? loadLinkedDemandsPage(payload, user, context.id, linkedDemandsPage)
      : Promise.resolve(emptyLinkedDemandsPage())
  const [municipalitySummary, authorNames, linkedDemands] = await Promise.all([
    municipalitySummaryPromise,
    authorNamesPromise,
    linkedDemandsPromise,
  ])

  return {
    ...toActivityDetailViewModel(context.document, activeTab, authorNames, municipalitySummary),
    ...linkedDemands,
  }
}
