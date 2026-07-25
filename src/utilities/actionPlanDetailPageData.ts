import 'server-only'

import type { Payload } from 'payload'

import type { ActionPlan, CampaignDemand, CampaignUser } from '@/payload-types'
import type { ActionPlanDetailTab } from '@/utilities/actionPlanDetailTabUi'
import type { AccessibleActionPlanContext } from '@/utilities/actionPlanPageData'
import {
  actionPlanMunicipalitySummary,
  toActionPlanDetailViewModel,
  type ActionPlanDetailViewModel,
  type ActionPlanMunicipalitySummary,
} from '@/utilities/actionPlanViewModels'
import { relationshipId } from '@/utilities/relationship'

type ActionPlanDemandSummary = {
  id: number
  title: string
  slug: string
  kind: CampaignDemand['kind']
  status: CampaignDemand['status']
  cost: number | null
}

const loadActionPlanUpdateAuthorNames = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  updates: NonNullable<ActionPlan['updates']>,
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
 * Display-name lookup for a plan's municipality when the document was loaded at
 * depth 0 (updates tab). The actor already passed row access on the plan
 * itself, so reading the municipality's name/slug privileged avoids a second
 * per-role access round-trip (established display-name pattern).
 */
const loadActionPlanMunicipalitySummaryById = async (
  payload: Pick<Payload, 'find'>,
  municipalityId: number,
): Promise<ActionPlanMunicipalitySummary | null> => {
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

export const getActionPlanDetailPageData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  context: AccessibleActionPlanContext,
  activeTab: ActionPlanDetailTab,
): Promise<
  ActionPlanDetailViewModel & {
    demands: ActionPlanDemandSummary[]
    demandCostTotal: number
  }
> => {
  const municipalityId = relationshipId(context.document.municipality)
  const populatedMunicipalitySummary =
    actionPlanMunicipalitySummary(context.document.municipality) ?? null
  const municipalitySummaryPromise = populatedMunicipalitySummary
    ? Promise.resolve(populatedMunicipalitySummary)
    : municipalityId
      ? loadActionPlanMunicipalitySummaryById(payload, municipalityId)
      : Promise.resolve(null)
  const authorNamesPromise =
    activeTab === 'updates' && context.document.updates?.length
      ? loadActionPlanUpdateAuthorNames(payload, user, context.document.updates)
      : Promise.resolve(new Map<number, string>())
  const demandSummariesPromise: Promise<ActionPlanDemandSummary[]> =
    activeTab === 'overview'
      ? payload
          .find({
            collection: 'campaignDemand',
            where: { actionPlan: { equals: context.id } },
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
    ...toActionPlanDetailViewModel(context.document, activeTab, authorNames, municipalitySummary),
    demands,
    demandCostTotal: demands.reduce((total, demand) => total + (demand.cost ?? 0), 0),
  }
}
