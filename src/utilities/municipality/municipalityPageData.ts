import 'server-only'

import type { Payload, Where } from 'payload'

import { bahiaIdentityTerritories } from '@/lib/bahiaTerritories'
import { engagementLevelRank } from '@/lib/engagementLevel'
import { getMunicipalityCatalogEntry, municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  compareMunicipalityVotesForSort,
  computeVoteRankByYear,
  DEFAULT_VOTE_RANK_YEAR,
  type MunicipalityVoteRankEntry,
} from '@/lib/municipalityVoteRank'
import { relationshipId } from '@/lib/relationship'
import { type VoteEstimateScenario } from '@/lib/voteEstimate'
import type { CampaignUser, Municipality } from '@/payload-types'
import { isCampaignLeader, isCampaignStaff } from '@/utilities/campaignAccess'
import { createEntityNotFoundError } from '@/utilities/entityNotFound'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'
import {
  centralDeficitSortValue,
  type MunicipalityGoalCoverage,
} from '@/utilities/municipality/goalCoverage'
import {
  loadMunicipalityGoalCoverageBundle,
  loadStatewideSuggestedGoals,
} from '@/utilities/municipality/municipalityGoalAccount'
import {
  buildMunicipalityListWhere,
  municipalityPageSize,
  parseMunicipalityListParams,
  resolveMunicipalityListSort,
  type MunicipalityListSearchParams,
  type MunicipalityListSortDirection,
  type MunicipalityListSortKey,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'
import { resolveMunicipalityLastSignalAt } from '@/utilities/municipality/municipalitySignal'
import {
  computeMunicipalityTerritorialClass,
  territorialClassSortWeight,
} from '@/utilities/municipality/municipalityTerritorialClass'
import {
  municipalityListSelect,
  toMunicipalityDetailViewModel,
  toMunicipalityListViewModel,
  type MunicipalityDetailViewModel,
  type MunicipalityListViewModel,
} from '@/utilities/municipality/municipalityViewModels'
import { loadStateDeputySummaries } from '@/utilities/stateDeputyData'
import {
  rollupMunicipalityStaffVotes,
  type MunicipalityPledgeAggregate,
} from '@/utilities/votePledgeViews'

export const MunicipalityNotFoundError = createEntityNotFoundError(
  'Municipality',
  'Município não encontrado.',
)

export type MunicipalityListOverviewData = {
  municipalityCount: number
  staffVoteTotalByScenario: Record<VoteEstimateScenario, number>
  pledgeCount: number
  missingEstimateCount: number
  withAdvisorCount: number
  /**
   * E9 "coluna da vergonha": priority municipalities in scope with nobody
   * answering for them — the one gap the coordination can close today, so it
   * gets named as a number and a filtered link instead of hiding inside the
   * assessoria ratio.
   */
  priorityWithoutAdvisorCount: number
  /** E8 "conta da cadeira" — meta × comprometido do escopo filtrado, por cenário. */
  goalCoverageByScenario: Record<VoteEstimateScenario, MunicipalityGoalCoverage>
}

/** Values still reachable under the OTHER active filters (column-filter options). */
type MunicipalityListFilterFacets = {
  /** Catalog order. */
  slugs: string[]
  regions: string[]
  advisorIDs: number[]
}

export type MunicipalityListPageBundle = {
  municipalities: MunicipalityListViewModel[]
  totalDocs: number
  totalPages: number
  scopeTotal: number
  overview: MunicipalityListOverviewData | null
  filterFacets: MunicipalityListFilterFacets
}

const emptyMunicipalityListFilterFacets: MunicipalityListFilterFacets = {
  slugs: [],
  regions: [],
  advisorIDs: [],
}

type MunicipalityFacetRow = Pick<Municipality, 'slug' | 'region' | 'advisors'>

/**
 * E10's class filter is the only one that isn't a Payload constraint (the
 * class is derived from the committed TSE artifact, not stored), so every
 * place that would otherwise trust `where` — the page query, the overview
 * scope and the facets — has to apply this predicate itself. Returns `null`
 * when no class is selected, which is also the signal to keep the cheap
 * database-paginated path.
 */
const territorialClassFilterPredicate = (
  state: MunicipalityListState,
): ((slug: string) => boolean) | null => {
  if (!state.classes?.length) return null
  const selected = new Set(state.classes)
  return (slug) => selected.has(computeMunicipalityTerritorialClass(slug).class)
}

/**
 * Each facet applies every filter owned by ANOTHER popover (so it only offers
 * values that still return rows) while omitting the ones its own popover owns —
 * including the checkbox/toggle sharing that popover, or selecting "Prioritária"
 * / "Sem assessor" would empty the very list it lives in. Identical `where`
 * shapes collapse into one read, and the already-loaded scope seeds the
 * unfiltered shape — with no filter active the facets cost no query at all.
 */
const loadMunicipalityListFilterFacets = async (
  payload: Payload,
  user: CampaignUser,
  state: MunicipalityListState,
  /** The scope read is a PROMISE so the facets can join the page's main `Promise.all` (B16+). */
  loadedScope: { where: Where; rows: Promise<MunicipalityFacetRow[]> } | null,
): Promise<MunicipalityListFilterFacets> => {
  // No facet popover owns the class filter, so every facet read keeps it
  // applied — inside the memo, so a `where` shared by two facets is filtered once.
  const classMatches = territorialClassFilterPredicate(state)
  const applyClassFilter = (rows: MunicipalityFacetRow[]): MunicipalityFacetRow[] =>
    classMatches ? rows.filter((row) => classMatches(row.slug)) : rows

  const rowsByWhere = new Map<string, Promise<MunicipalityFacetRow[]>>()
  if (loadedScope) {
    rowsByWhere.set(JSON.stringify(loadedScope.where), loadedScope.rows.then(applyClassFilter))
  }
  const facetRows = (omit: Partial<MunicipalityListState>): Promise<MunicipalityFacetRow[]> => {
    const where = buildMunicipalityListWhere({ ...state, ...omit })
    const key = JSON.stringify(where)
    const pending = rowsByWhere.get(key)
    if (pending) return pending

    const rows = payload
      .find({
        collection: 'municipality',
        where,
        depth: 0,
        limit: 0,
        pagination: false,
        select: { slug: true, region: true, advisors: true },
        user,
        overrideAccess: false,
      })
      .then((result) => applyClassFilter(result.docs as MunicipalityFacetRow[]))
    rowsByWhere.set(key, rows)
    return rows
  }

  const [slugRows, regionRows, advisorRows] = await Promise.all([
    facetRows({ slugs: undefined, priority: undefined }),
    facetRows({ regions: undefined }),
    facetRows({ advisors: undefined, coverage: undefined }),
  ])

  // Selected values are unioned in: a selection must stay visible to be undone.
  const availableSlugs = new Set([...slugRows.map((row) => row.slug), ...(state.slugs ?? [])])
  const availableRegions = new Set<string>([
    ...regionRows.map((row) => row.region),
    ...(state.regions ?? []),
  ])
  const availableAdvisorIDs = new Set<number>(state.advisors ?? [])
  for (const row of advisorRows) {
    for (const advisor of row.advisors ?? []) {
      const id = relationshipId(advisor)
      if (id !== null) availableAdvisorIDs.add(id)
    }
  }

  return {
    slugs: municipalityCatalog
      .filter((entry) => availableSlugs.has(entry.slug))
      .map((entry) => entry.slug),
    regions: bahiaIdentityTerritories.filter((territory) => availableRegions.has(territory)),
    advisorIDs: [...availableAdvisorIDs].sort((left, right) => left - right),
  }
}

const payloadSortFieldByKey: Partial<Record<MunicipalityListSortKey, string>> = {
  name: 'name',
  region: 'region',
  lastUpdateAt: 'lastUpdateAt',
  trend: 'politicalTrend.status',
  // E9 (deficit, frescor), E10 (classe) and E14 (nivel) are absent on purpose:
  // the first three are derived, and `nivel` needs its NULLs at the end, which
  // the query cannot express.
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

type DerivedSortContext = {
  ranks: ReadonlyMap<string, MunicipalityVoteRankEntry>
  goalCoverageByMunicipalityID: ReadonlyMap<
    number,
    Record<VoteEstimateScenario, MunicipalityGoalCoverage>
  >
  pledgeAggregates: ReadonlyMap<number, MunicipalityPledgeAggregate>
}

const applyDerivedMunicipalitySort = (
  docs: Municipality[],
  sortKey: MunicipalityListSortKey,
  dir: MunicipalityListSortDirection,
  { ranks, goalCoverageByMunicipalityID, pledgeAggregates }: DerivedSortContext,
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
    case 'deficit':
      // Fixed to `central`: the scenario picker is client-side state, so the
      // server has no scenario to sort by (moving it to the URL is the
      // "Cenário junto aos filtros" fill-in). A município with no goal at all
      // has no deficit to rank — `null` sends it to the end either way.
      return sortByNullableValue(docs, dir, (municipality) =>
        centralDeficitSortValue(goalCoverageByMunicipalityID.get(municipality.id)?.central),
      )
    case 'frescor': {
      // One clock read for the whole sort: the accessor runs per comparison,
      // and a "now" that drifts mid-sort is not a consistent ordering key.
      const now = Date.now()
      // Descending = coldest first, so "never had a signal" must outrank the
      // oldest date instead of sinking as a null: age is +Infinity there.
      return sortByNullableValue(docs, dir, (municipality) => {
        const lastSignalAt = resolveMunicipalityLastSignalAt(
          municipality.lastUpdateAt ?? null,
          pledgeAggregates.get(municipality.id)?.lastPledgeAt ?? null,
        )
        if (!lastSignalAt) return Number.POSITIVE_INFINITY
        return now - new Date(lastSignalAt).getTime()
      })
    }
    case 'nivel':
      // Stored, so Postgres could order it — but Postgres puts NULLs FIRST on
      // DESC, and with no backfill that hands "N4 primeiro" a page of "Sem
      // nível". Absence of a decision is not the top of the ladder: it sorts
      // like `sem_base` above, at the end in either direction.
      return sortByNullableValue(docs, dir, (municipality) =>
        municipality.engagementLevel ? engagementLevelRank[municipality.engagementLevel] : null,
      )
    case 'classe':
      // Ordinal weight, not the label: descending means reduto first, and
      // `sem_base` (no weight) lands at the end in either direction.
      return sortByNullableValue(
        docs,
        dir,
        (municipality) =>
          territorialClassSortWeight[computeMunicipalityTerritorialClass(municipality.slug).class],
      )
    default:
      // Native keys reach here when a derived FILTER forced the in-memory
      // path; the query already sorted them, so the order is preserved.
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
      filterFacets: emptyMunicipalityListFilterFacets,
    }
  }

  const ranks = computeVoteRankByYear(DEFAULT_VOTE_RANK_YEAR)
  const nativeSortField = payloadSortFieldByKey[sortKey]
  const classMatches = territorialClassFilterPredicate(state)
  // A derived filter can't be expressed in `where`, so it forces the
  // load-everything path even when the SORT itself is native — otherwise the
  // page would drop rows out of a 25-row window and `totalDocs` would count
  // municípios the filter excludes.
  const isPagedByPayload = nativeSortField !== undefined && !classMatches

  const listQuery = payload.find({
    collection: 'municipality',
    depth: 0,
    where,
    select: municipalityListSelect,
    user,
    overrideAccess: false,
    // Kept outside the pagination branch: with a class filter the query is
    // still the cheapest place to order by a native field.
    ...(nativeSortField ? { sort: `${sortDir === 'desc' ? '-' : ''}${nativeSortField}` } : {}),
    ...(isPagedByPayload
      ? {
          limit: municipalityPageSize,
          page: state.page,
        }
      : {
          limit: 0,
          pagination: false,
        }),
  })

  // Request-scoped shared load (docs + pledge aggregates in one place).
  const staffScopePromise = isStaff
    ? loadMunicipalityScope(payload, user, where)
    : Promise.resolve(null)

  const [listResult, scopeCount, staffScope, filterFacets] = await Promise.all([
    listQuery,
    payload.count({
      collection: 'municipality',
      where: {},
      user,
      overrideAccess: false,
    }),
    staffScopePromise,
    // Joins the same round of reads: its seed key derives from `where`
    // synchronously, and the scope rows arrive as a promise (B16+).
    loadMunicipalityListFilterFacets(
      payload,
      user,
      state,
      isStaff
        ? { where, rows: staffScopePromise.then((scope) => scope?.municipalities ?? []) }
        : null,
    ),
    // Result discarded on purpose: the `campaignGoals` read below is
    // `cache()`-deduplicated, so starting it here moves it off the tail of the
    // request instead of adding a round trip after everything else resolved.
    isStaff ? loadStatewideSuggestedGoals(payload, user) : null,
  ])

  let overview: MunicipalityListOverviewData | null = null
  let pledgeAggregates = new Map<number, MunicipalityPledgeAggregate>()
  let goalCoverageByMunicipalityID = new Map<
    number,
    Record<VoteEstimateScenario, MunicipalityGoalCoverage>
  >()

  // Computed even for an empty filtered scope: the overview stays on screen
  // (zeroed) next to the empty state instead of disappearing with the rows.
  if (staffScope) {
    pledgeAggregates = staffScope.pledgeAggregates
    // Never mutate the scope: `loadMunicipalityScope` is request-cached and
    // shared with the facets. Filtering here is what keeps the overview
    // (E8 coverage, E9 shame column) counting the filtered scope.
    const scopedMunicipalities = classMatches
      ? staffScope.municipalities.filter((municipality) => classMatches(municipality.slug))
      : staffScope.municipalities
    const rollup = rollupMunicipalityStaffVotes(scopedMunicipalities, pledgeAggregates)
    const goalCoverageBundle = await loadMunicipalityGoalCoverageBundle(
      payload,
      user,
      scopedMunicipalities,
      pledgeAggregates,
    )
    goalCoverageByMunicipalityID = goalCoverageBundle.coverageByMunicipalityID
    overview = {
      municipalityCount: scopedMunicipalities.length,
      staffVoteTotalByScenario: { ...rollup.staffVoteTotalByScenario },
      pledgeCount: rollup.pledgeCount,
      missingEstimateCount: rollup.missingEstimateCount,
      withAdvisorCount: scopedMunicipalities.filter(
        (municipality) => (municipality.advisors ?? []).length > 0,
      ).length,
      priorityWithoutAdvisorCount: scopedMunicipalities.filter(
        (municipality) =>
          municipality.priority === 'alta' && (municipality.advisors ?? []).length === 0,
      ).length,
      goalCoverageByScenario: goalCoverageBundle.aggregateByScenario,
    }
  }

  let pageDocs: Municipality[]
  let totalDocs: number
  let totalPages: number

  if (isPagedByPayload) {
    // Payload select narrows the inferred type; the selected fields cover the view model.
    pageDocs = listResult.docs as Municipality[]
    totalDocs = listResult.totalDocs
    totalPages = listResult.totalPages
  } else {
    const scopedDocs = classMatches
      ? (listResult.docs as Municipality[]).filter((municipality) =>
          classMatches(municipality.slug),
        )
      : (listResult.docs as Municipality[])
    const allDocs = applyDerivedMunicipalitySort(scopedDocs, sortKey, sortDir, {
      ranks,
      goalCoverageByMunicipalityID,
      pledgeAggregates,
    })
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
        isStaff ? goalCoverageByMunicipalityID.get(municipality.id) : undefined,
      ),
    ),
    totalDocs,
    totalPages,
    scopeTotal: scopeCount.totalDocs,
    overview,
    filterFacets,
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
      // Intentional admin bypass: display-name resolution for the staff member
      // who recorded the trend — an advisor cannot read `campaignUser` rows,
      // but the audit attribution of a record he can already see must name its
      // author. Only `name` is selected.
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
