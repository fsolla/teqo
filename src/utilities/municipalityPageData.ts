import type { Payload } from 'payload'

import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import type { CampaignUser, Municipality } from '@/payload-types'
import { isCampaignLeader, isCampaignStaff } from '@/utilities/campaignAccess'
import {
  buildMunicipalityListWhere,
  municipalityPageSize,
  parseMunicipalityListParams,
  type MunicipalityListSearchParams,
} from '@/utilities/municipalityUi'
import {
  municipalityListSelect,
  toMunicipalityDetailViewModel,
  toMunicipalityListViewModel,
  type MunicipalityDetailViewModel,
  type MunicipalityListViewModel,
} from '@/utilities/municipalityViewModels'
import { relationshipId } from '@/utilities/relationship'
import { loadStateDeputySummaries } from '@/utilities/stateDeputyData'
import { type VoteEstimateScenario } from '@/utilities/voteEstimate'
import {
  aggregatePledgesByMunicipality,
  rollupMunicipalityStaffVotes,
  type MunicipalityPledgeAggregate,
} from '@/utilities/votePledgeData'

const municipalityListFilteredSelect = {
  id: true,
  slug: true,
  name: true,
  kind: true,
  ibgeCode: true,
  expectedVotes: true,
  advisors: true,
  priority: true,
} as const

export class MunicipalityNotFoundError extends Error {
  override name = 'MunicipalityNotFoundError'

  constructor() {
    super('Município não encontrado.')
  }
}

export type MunicipalityListOverviewData = {
  municipalityCount: number
  staffVoteTotalByScenario: Record<VoteEstimateScenario, number>
  pledgeCount: number
  missingEstimateCount: number
  withAdvisorCount: number
}

export type MunicipalityListPageBundle = {
  municipalities: MunicipalityListViewModel[]
  totalDocs: number
  totalPages: number
  scopeTotal: number
  overview: MunicipalityListOverviewData | null
}

export const loadMunicipalityListPageBundle = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: MunicipalityListSearchParams,
): Promise<MunicipalityListPageBundle> => {
  const state = parseMunicipalityListParams(searchParams)
  const where = buildMunicipalityListWhere(state)
  const isStaff = isCampaignStaff(user)

  if (isCampaignLeader(user)) {
    return {
      municipalities: [],
      totalDocs: 0,
      totalPages: 0,
      scopeTotal: 0,
      overview: null,
    }
  }

  const [paginatedResult, scopeCount, filteredResult] = await Promise.all([
    payload.find({
      collection: 'municipality',
      depth: 0,
      limit: municipalityPageSize,
      page: state.page,
      sort: 'name',
      where,
      select: municipalityListSelect,
      user,
      overrideAccess: false,
    }),
    payload.count({
      collection: 'municipality',
      where: {},
      user,
      overrideAccess: false,
    }),
    isStaff
      ? payload.find({
          collection: 'municipality',
          depth: 0,
          limit: 0,
          pagination: false,
          where,
          select: municipalityListFilteredSelect,
          user,
          overrideAccess: false,
        })
      : Promise.resolve(null),
  ])

  let overview: MunicipalityListOverviewData | null = null
  let pledgeAggregates = new Map<number, MunicipalityPledgeAggregate>()

  if (filteredResult && filteredResult.docs.length > 0) {
    pledgeAggregates = await aggregatePledgesByMunicipality(
      payload,
      filteredResult.docs.map((municipality) => municipality.id),
    )

    if (isStaff) {
      const rollup = rollupMunicipalityStaffVotes(filteredResult.docs, pledgeAggregates)
      overview = {
        municipalityCount: filteredResult.docs.length,
        staffVoteTotalByScenario: { ...rollup.staffVoteTotalByScenario },
        pledgeCount: rollup.pledgeCount,
        missingEstimateCount: rollup.missingEstimateCount,
        withAdvisorCount: filteredResult.docs.filter(
          (municipality) => (municipality.advisors ?? []).length > 0,
        ).length,
      }
    }
  }

  return {
    municipalities: paginatedResult.docs.map((municipality) =>
      toMunicipalityListViewModel(
        municipality as Municipality,
        isStaff ? pledgeAggregates.get(municipality.id) : undefined,
      ),
    ),
    totalDocs: paginatedResult.totalDocs,
    totalPages: paginatedResult.totalPages,
    scopeTotal: scopeCount.totalDocs,
    overview,
  }
}

export type AccessibleMunicipalityContext = {
  id: number
  slug: string
  document: Municipality
}

export const resolveAccessibleMunicipalityContext = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  municipalitySlug: string,
): Promise<AccessibleMunicipalityContext> => {
  const result = await payload.find({
    collection: 'municipality',
    where: { slug: { equals: municipalitySlug } },
    depth: 0,
    limit: 1,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const municipality = result.docs[0]
  if (!municipality) throw new MunicipalityNotFoundError()

  return {
    id: municipality.id,
    slug: municipality.slug,
    document: municipality as Municipality,
  }
}

export const getMunicipalityDetailViewModel = async (
  payload: Payload,
  context: AccessibleMunicipalityContext,
  user: CampaignUser,
): Promise<MunicipalityDetailViewModel> => {
  const catalogEntry = getMunicipalityCatalogEntry(context.slug)
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

  const stateDeputyIDs = (context.document.stateDeputies ?? [])
    .map(relationshipId)
    .filter((id): id is number => id !== null)
  const stateDeputies =
    user.role === 'leader' ? [] : await loadStateDeputySummaries(payload, stateDeputyIDs)

  return toMunicipalityDetailViewModel(
    context.document,
    user.role,
    tseZones,
    trendRecordedByName,
    stateDeputies,
  )
}
