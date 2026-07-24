import type { Payload } from 'payload'

import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import {
  compareMunicipalityVotesForSort,
  computeVoteRankByYear,
  DEFAULT_VOTE_RANK_YEAR,
  type MunicipalityVoteRankEntry,
} from '@/lib/municipalityVoteRank'
import type { CampaignUser, Municipality } from '@/payload-types'
import { isCampaignLeader, isCampaignStaff } from '@/utilities/campaignAccess'
import { loadMunicipalityScope } from '@/utilities/campaignMunicipalityScope'
import {
  buildMunicipalityListWhere,
  municipalityPageSize,
  parseMunicipalityListParams,
  resolveMunicipalityListSort,
  type MunicipalityListSearchParams,
  type MunicipalityListSortDirection,
  type MunicipalityListSortKey,
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
  rollupMunicipalityStaffVotes,
  type MunicipalityPledgeAggregate,
} from '@/utilities/votePledgeData'

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

const payloadSortFieldByKey: Partial<Record<MunicipalityListSortKey, string>> = {
  name: 'name',
  region: 'region',
  kind: 'kind',
  lastUpdateAt: 'lastUpdateAt',
  trend: 'politicalTrend.status',
}

const municipalityNameCompare = (left: Municipality, right: Municipality): number =>
  left.name.localeCompare(right.name, 'pt-BR')

type MunicipalityValueAccessor = (municipality: Municipality) => number | null | undefined

const sortByNullableValue = (
  docs: Municipality[],
  dir: MunicipalityListSortDirection,
  getValue: MunicipalityValueAccessor,
): Municipality[] => {
  const direction = dir === 'asc' ? 1 : -1
  return [...docs].sort((left, right) => {
    const leftValue = getValue(left) ?? null
    const rightValue = getValue(right) ?? null
    if (leftValue === null && rightValue === null) return municipalityNameCompare(left, right)
    if (leftValue === null) return 1
    if (rightValue === null) return -1
    if (leftValue === rightValue) return municipalityNameCompare(left, right)
    return (leftValue - rightValue) * direction
  })
}

const applyDerivedMunicipalitySort = (
  docs: Municipality[],
  sortKey: MunicipalityListSortKey,
  dir: MunicipalityListSortDirection,
  ranks: ReadonlyMap<string, MunicipalityVoteRankEntry>,
): Municipality[] => {
  switch (sortKey) {
    case 'expectedVotes':
      return sortByNullableValue(docs, dir, (municipality) => municipality.expectedVotes?.central)
    case 'coverage':
      return sortByNullableValue(docs, dir, (municipality) => municipality.advisors?.length)
    case 'votos':
      return [...docs].sort((left, right) => {
        const byVotes = compareMunicipalityVotesForSort(
          ranks.get(left.slug)?.votes ?? 0,
          ranks.get(right.slug)?.votes ?? 0,
          dir,
        )
        if (byVotes !== 0) return byVotes
        return municipalityNameCompare(left, right)
      })
    default:
      return docs
  }
}

export const loadMunicipalityListPageBundle = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: MunicipalityListSearchParams,
): Promise<MunicipalityListPageBundle> => {
  const state = parseMunicipalityListParams(searchParams)
  const where = buildMunicipalityListWhere(state)
  const isStaff = isCampaignStaff(user)
  const { sort: sortKey, dir: sortDir } = resolveMunicipalityListSort(state)

  if (isCampaignLeader(user)) {
    return {
      municipalities: [],
      totalDocs: 0,
      totalPages: 0,
      scopeTotal: 0,
      overview: null,
    }
  }

  const ranks = computeVoteRankByYear(DEFAULT_VOTE_RANK_YEAR)
  const nativeSortField = payloadSortFieldByKey[sortKey]
  const isNative = nativeSortField !== undefined

  const listQuery = payload.find({
    collection: 'municipality',
    depth: 0,
    where,
    select: municipalityListSelect,
    user,
    overrideAccess: false,
    ...(isNative
      ? {
          limit: municipalityPageSize,
          page: state.page,
          sort: `${sortDir === 'desc' ? '-' : ''}${nativeSortField}`,
        }
      : {
          limit: 0,
          pagination: false,
        }),
  })

  const [listResult, scopeCount, staffScope] = await Promise.all([
    listQuery,
    payload.count({
      collection: 'municipality',
      where: {},
      user,
      overrideAccess: false,
    }),
    // Request-scoped shared load (docs + pledge aggregates in one place).
    isStaff ? loadMunicipalityScope(payload, user, where) : Promise.resolve(null),
  ])

  let overview: MunicipalityListOverviewData | null = null
  let pledgeAggregates = new Map<number, MunicipalityPledgeAggregate>()

  if (staffScope && staffScope.municipalities.length > 0) {
    pledgeAggregates = staffScope.pledgeAggregates
    const rollup = rollupMunicipalityStaffVotes(staffScope.municipalities, pledgeAggregates)
    overview = {
      municipalityCount: staffScope.municipalities.length,
      staffVoteTotalByScenario: { ...rollup.staffVoteTotalByScenario },
      pledgeCount: rollup.pledgeCount,
      missingEstimateCount: rollup.missingEstimateCount,
      withAdvisorCount: staffScope.municipalities.filter(
        (municipality) => (municipality.advisors ?? []).length > 0,
      ).length,
    }
  }

  let pageDocs: Municipality[]
  let totalDocs: number
  let totalPages: number

  if (isNative) {
    // Payload select narrows the inferred type; the selected fields cover the view model.
    pageDocs = listResult.docs as Municipality[]
    totalDocs = listResult.totalDocs
    totalPages = listResult.totalPages
  } else {
    const allDocs = applyDerivedMunicipalitySort(
      listResult.docs as Municipality[],
      sortKey,
      sortDir,
      ranks,
    )
    totalDocs = allDocs.length
    totalPages = Math.max(1, Math.ceil(totalDocs / municipalityPageSize))
    const start = (state.page - 1) * municipalityPageSize
    pageDocs = allDocs.slice(start, start + municipalityPageSize)
  }

  return {
    municipalities: pageDocs.map((municipality) =>
      toMunicipalityListViewModel(
        municipality,
        isStaff ? pledgeAggregates.get(municipality.id) : undefined,
        ranks.get(municipality.slug) ?? null,
      ),
    ),
    totalDocs,
    totalPages,
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
