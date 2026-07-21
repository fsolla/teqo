import type { Payload } from 'payload'

import { getPlazaCatalogEntry } from '@/lib/plazaCatalog'
import type { CampaignUser, Plaza } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import {
  buildPlazaMapBundleFromPlazas,
  scopePlazasFromDocs,
  type PlazaMapBundle,
} from '@/utilities/plazaMapData'
import {
  buildPlazaListWhere,
  parsePlazaListParams,
  plazaPageSize,
  type PlazaListSearchParams,
} from '@/utilities/plazaUi'
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
  type PlazaPledgeAggregate,
} from '@/utilities/votePledgeData'

const plazaListFilteredSelect = {
  id: true,
  slug: true,
  name: true,
  kind: true,
  ibgeCode: true,
  expectedVotes: true,
  advisors: true,
  priority: true,
} as const

export class PlazaNotFoundError extends Error {
  override name = 'PlazaNotFoundError'

  constructor() {
    super('Praça não encontrada.')
  }
}

export type PlazaListOverviewData = {
  plazaCount: number
  staffVoteTotal: number
  pledgeCount: number
  missingEstimateCount: number
  withAdvisorCount: number
}

export type PlazaListPageBundle = {
  plazas: PlazaListViewModel[]
  totalDocs: number
  totalPages: number
  scopeTotal: number
  overview: PlazaListOverviewData | null
  mapBundle: PlazaMapBundle | null
}

export const loadPlazaListPageBundle = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: PlazaListSearchParams,
): Promise<PlazaListPageBundle> => {
  const state = parsePlazaListParams(searchParams)
  const where = buildPlazaListWhere(state)
  const isStaff = isCampaignStaff(user)

  const [paginatedResult, scopeCount, filteredResult] = await Promise.all([
    payload.find({
      collection: 'plaza',
      depth: 0,
      limit: plazaPageSize,
      page: state.page,
      sort: 'name',
      where,
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
    isStaff
      ? payload.find({
          collection: 'plaza',
          depth: 0,
          limit: 0,
          pagination: false,
          where,
          select: plazaListFilteredSelect,
          user,
          overrideAccess: false,
        })
      : Promise.resolve(null),
  ])

  let overview: PlazaListOverviewData | null = null
  let mapBundle: PlazaMapBundle | null = null
  let pledgeAggregates = new Map<number, PlazaPledgeAggregate>()

  if (filteredResult && filteredResult.docs.length > 0) {
    pledgeAggregates = await aggregatePledgesByPlaza(
      payload,
      filteredResult.docs.map((plaza) => plaza.id),
    )

    if (isStaff) {
      const { staffVoteTotal, pledgeCount, missingEstimateCount } = rollupPlazaStaffVotes(
        filteredResult.docs,
        pledgeAggregates,
      )
      overview = {
        plazaCount: filteredResult.docs.length,
        staffVoteTotal,
        pledgeCount,
        missingEstimateCount,
        withAdvisorCount: filteredResult.docs.filter((plaza) => (plaza.advisors ?? []).length > 0)
          .length,
      }
    }

    const scopedPlazas = scopePlazasFromDocs(filteredResult.docs)
    if (scopedPlazas.length > 0) {
      mapBundle = await buildPlazaMapBundleFromPlazas(
        payload,
        user,
        state,
        scopedPlazas,
        pledgeAggregates,
      )
    }
  }

  return {
    plazas: paginatedResult.docs.map((plaza) =>
      toPlazaListViewModel(
        plaza as Plaza,
        isStaff ? pledgeAggregates.get(plaza.id) : undefined,
      ),
    ),
    totalDocs: paginatedResult.totalDocs,
    totalPages: paginatedResult.totalPages,
    scopeTotal: scopeCount.totalDocs,
    overview,
    mapBundle,
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
