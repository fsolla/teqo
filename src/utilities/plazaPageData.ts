import type { Payload } from 'payload'

import { getPlazaCatalogEntry } from '@/lib/plazaCatalog'
import type { CampaignUser, Plaza } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { buildPlazaListWhere, parsePlazaListParams, plazaPageSize } from '@/utilities/plazaUi'
import {
  plazaListSelect,
  toPlazaDetailViewModel,
  toPlazaListViewModel,
  type PlazaDetailViewModel,
  type PlazaListViewModel,
} from '@/utilities/plazaViewModels'
import { relationshipId } from '@/utilities/relationship'
import {
  aggregatePledgesByPlaza,
  rollupPlazaStaffVotes,
} from '@/utilities/votePledgeData'

type PlazaListSearchParams = Record<string, string | string[] | undefined>

export class PlazaNotFoundError extends Error {
  override name = 'PlazaNotFoundError'

  constructor() {
    super('Praça não encontrada.')
  }
}

export const loadPlazaListPageData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: PlazaListSearchParams,
): Promise<{
  plazas: PlazaListViewModel[]
  totalDocs: number
  totalPages: number
  scopeTotal: number
}> => {
  const state = parsePlazaListParams(searchParams)
  const [result, scope] = await Promise.all([
    payload.find({
      collection: 'plaza',
      depth: 0,
      limit: plazaPageSize,
      page: state.page,
      sort: 'name',
      where: buildPlazaListWhere(state),
      select: plazaListSelect,
      user,
      overrideAccess: false,
    }),
    payload.count({
      collection: 'plaza',
      where: {},
      user,
      overrideAccess: false,
    }),
  ])

  const pledgeAggregates = isCampaignStaff(user)
    ? await aggregatePledgesByPlaza(
        payload,
        result.docs.map((plaza) => plaza.id),
      )
    : new Map()

  return {
    plazas: result.docs.map((plaza) =>
      toPlazaListViewModel(plaza as Plaza, pledgeAggregates.get(plaza.id)),
    ),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    scopeTotal: scope.totalDocs,
  }
}

export type PlazaListOverviewData = {
  plazaCount: number
  staffVoteTotal: number
  declaredVotesTotal: number
  pledgeCount: number
  missingEstimateCount: number
  withAdvisorCount: number
  highPriorityCount: number
}

/** Staff aggregate over the ENTIRE filtered set (not just the current page). */
export const loadPlazaListOverviewData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: PlazaListSearchParams,
): Promise<PlazaListOverviewData | null> => {
  if (!isCampaignStaff(user)) return null

  const state = parsePlazaListParams(searchParams)
  const result = await payload.find({
    collection: 'plaza',
    depth: 0,
    limit: 0,
    pagination: false,
    where: buildPlazaListWhere(state),
    select: { advisors: true, priority: true, expectedVotes: true },
    user,
    overrideAccess: false,
  })
  if (result.docs.length === 0) return null

  const plazaIDs = result.docs.map((plaza) => plaza.id)
  const pledgeAggregates = await aggregatePledgesByPlaza(payload, plazaIDs)
  const {
    staffVoteTotal,
    declaredVotesTotal,
    pledgeCount,
    missingEstimateCount,
  } = rollupPlazaStaffVotes(result.docs, pledgeAggregates)

  return {
    plazaCount: result.docs.length,
    staffVoteTotal,
    declaredVotesTotal,
    pledgeCount,
    missingEstimateCount,
    withAdvisorCount: result.docs.filter((plaza) => (plaza.advisors ?? []).length > 0).length,
    highPriorityCount: result.docs.filter((plaza) => plaza.priority === 'alta').length,
  }
}

export type AccessiblePlazaContext = {
  id: number
  slug: string
  document: Plaza
}

export const resolveAccessiblePlazaContext = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  plazaSlug: string,
): Promise<AccessiblePlazaContext> => {
  const result = await payload.find({
    collection: 'plaza',
    where: { slug: { equals: plazaSlug } },
    depth: 0,
    limit: 1,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const plaza = result.docs[0]
  if (!plaza) throw new PlazaNotFoundError()

  return {
    id: plaza.id,
    slug: plaza.slug,
    document: plaza as Plaza,
  }
}

export const getPlazaDetailViewModel = async (
  payload: Payload,
  context: AccessiblePlazaContext,
  user: CampaignUser,
): Promise<PlazaDetailViewModel> => {
  const catalogEntry = getPlazaCatalogEntry(context.slug)
  const tseZones = catalogEntry ? [...catalogEntry.tseZones] : []

  let trendRecordedByName: string | null = null
  const recordedByID = relationshipId(context.document.politicalTrend?.recordedBy)
  if (user.role !== 'leader' && recordedByID) {
    try {
      const recorder = await payload.findByID({
        collection: 'campaignUser',
        id: recordedByID,
        depth: 0,
        select: { name: true },
        overrideAccess: true,
      })
      trendRecordedByName = recorder.name
    } catch {
      trendRecordedByName = null
    }
  }

  return toPlazaDetailViewModel(context.document, user.role, tseZones, trendRecordedByName)
}
