import 'server-only'

import type { Payload } from 'payload'

import type { Activity, CampaignDemand, CampaignUser } from '@/payload-types'
import type { ActivityDetailTab } from '@/utilities/activityDetailTabUi'
import type { AccessibleActivityContext } from '@/utilities/activityPageData'
import {
  activityMunicipalitySummary,
  toActivityDetailViewModel,
  type ActivityDetailViewModel,
  type ActivityMunicipalitySummary,
} from '@/utilities/activityViewModels'
import { relationshipId } from '@/utilities/relationship'

type ActivityDemandSummary = {
  id: number
  title: string
  slug: string
  kind: CampaignDemand['kind']
  status: CampaignDemand['status']
  cost: number | null
}

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

export const getActivityDetailPageData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  context: AccessibleActivityContext,
  activeTab: ActivityDetailTab,
): Promise<
  ActivityDetailViewModel & {
    demands: ActivityDemandSummary[]
    demandCostTotal: number
  }
> => {
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
  const demandSummariesPromise: Promise<ActivityDemandSummary[]> =
    activeTab === 'overview'
      ? payload
          .find({
            collection: 'campaignDemand',
            where: { activity: { equals: context.id } },
            depth: 0,
            pagination: false,
            sort: 'createdAt',
            select: { title: true, slug: true, kind: true, status: true, cost: true },
            user,
            overrideAccess: false,
          })
          .then(({ docs }) =>
            docs.map((demand) => ({
              id: demand.id,
              title: demand.title,
              slug: demand.slug,
              kind: demand.kind,
              status: demand.status,
              cost: demand.cost ?? null,
            })),
          )
      : Promise.resolve([])
  const [municipalitySummary, authorNames, demands] = await Promise.all([
    municipalitySummaryPromise,
    authorNamesPromise,
    demandSummariesPromise,
  ])

  return {
    ...toActivityDetailViewModel(context.document, activeTab, authorNames, municipalitySummary),
    demands,
    demandCostTotal: demands.reduce((total, demand) => total + (demand.cost ?? 0), 0),
  }
}
