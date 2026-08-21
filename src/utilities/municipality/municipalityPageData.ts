import 'server-only'

import type { Payload, Where } from 'payload'

import { bahiaIdentityTerritories } from '@/lib/bahiaTerritories'
import { advisorEditingScope, type AdvisorEditingScope } from '@/lib/campaignAdvisorProfile'
import { engagementLevelRank } from '@/lib/engagementLevel'
import { getMunicipalityCatalogEntry, municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  compareMunicipalityVotesForSort,
  computeVoteRankByYear,
  DEFAULT_VOTE_RANK_YEAR,
  type MunicipalityVoteRankEntry,
} from '@/lib/municipalityVoteRank'
import { relationshipId } from '@/lib/relationship'
import { SALVADOR_CITY_SLUG } from '@/lib/salvadorCity'
import { type VoteEstimateScenario } from '@/lib/voteEstimate'
import type { CampaignUser, Municipality } from '@/payload-types'
import { getAdvisorMunicipalityIds } from '@/utilities/access/municipalities'
import {
  isCampaignLeader,
  isCampaignStaff,
  isCampaignUnrestricted,
} from '@/utilities/campaignAccess'
import { NO_PARTY_FILTER_VALUE } from '@/utilities/campaignListUrl'
import { createEntityNotFoundError } from '@/utilities/entityNotFound'
import {
  loadMunicipalityScope,
  loadMunicipalityScopeFromDocs,
} from '@/utilities/municipality/campaignMunicipalityScope'
import {
  centralDeficitSortValue,
  type MunicipalityGoalCoverage,
} from '@/utilities/municipality/goalCoverage'
import {
  buildCityMunicipalityDoc,
  cityMatchesFilter,
  cityTerritorialClass,
  insertCityAtNativeSortPosition,
} from '@/utilities/municipality/municipalityCityRow'
import {
  loadMunicipalityGoalCoverageBundle,
  loadStatewideSuggestedGoals,
} from '@/utilities/municipality/municipalityGoalAccount'
import {
  buildMunicipalityListWhere,
  municipalityPageSize,
  parseMunicipalityListParams,
  resolveMunicipalityListSort,
  type MunicipalityListRelationCatalog,
  type MunicipalityListSearchParams,
  type MunicipalityListSortDirection,
  type MunicipalityListSortKey,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'
import { loadMunicipalityListRelationCatalog } from '@/utilities/municipality/municipalityRelationSets'
import { resolveMunicipalityLastSignalAt } from '@/utilities/municipality/municipalitySignal'
import {
  computeMunicipalityTerritorialClass,
  territorialClassSortWeight,
  type MunicipalityTerritorialClassification,
} from '@/utilities/municipality/municipalityTerritorialClass'
import { loadMunicipalityLastUpdates } from '@/utilities/municipality/municipalityUpdatePageData'
import {
  loadMunicipalityLeadershipSummaries,
  municipalityListSelect,
  toMunicipalityDetailViewModel,
  toMunicipalityListViewModel,
  type MunicipalityDetailViewModel,
  type MunicipalityLeadershipSummary,
  type MunicipalityListViewModel,
} from '@/utilities/municipality/municipalityViewModels'
import {
  citySortVoteEntry,
  cityVoteRankEntry,
} from '@/utilities/municipality/salvadorCityAggregates'
import { loadStateDeputySummaries } from '@/utilities/stateDeputyData'
import { type MunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

export const MunicipalityNotFoundError = createEntityNotFoundError(
  'Municipality',
  'Município não encontrado.',
)

/**
 * C142 — resolve the UI write-scope for a municipality surface (list row,
 * detail page). Non-advisors (coordinator/candidate) get full write scope;
 * advisors derive from their permission profile and portfolio. The result
 * feeds server→client props so the UI can gate writes without a new provider.
 */
export type MunicipalityWriteScope = {
  editingScope: AdvisorEditingScope
  /** `null` = the whole catalog is writable; `Set` = only these IDs are writable. */
  portfolioIDs: ReadonlySet<number> | null
}

export const resolveMunicipalityWriteScope = async (
  payload: Payload,
  user: CampaignUser,
): Promise<MunicipalityWriteScope> => {
  if (isCampaignUnrestricted(user)) return { editingScope: 'tudo', portfolioIDs: null }

  const editingScope = advisorEditingScope(user.visibility, user.editing)
  if (editingScope === 'none') return { editingScope: 'none', portfolioIDs: new Set<number>() }
  if (editingScope === 'tudo') return { editingScope: 'tudo', portfolioIDs: null }

  // 'carteira': the portfolio is the set of administered municipalities.
  const ids = await getAdvisorMunicipalityIds(payload, user.id)
  return { editingScope: 'carteira', portfolioIDs: new Set(ids) }
}

/** Values still reachable under the OTHER active filters (column-filter options). */
type MunicipalityListFilterFacets = {
  /** Catalog order. */
  slugs: string[]
  regions: string[]
  advisorIDs: number[]
  /** B176 — stateDeputy ids still reachable under the other filters. */
  stateDeputyIDs: number[]
  /** B176 — leadership id+name pairs still reachable under the other filters. */
  leadershipOptions: MunicipalityLeadershipSummary[]
  /** B176 — party names still reachable under the other filters (no sentinel). */
  parties: string[]
}

export type MunicipalityListPageBundle = {
  municipalities: MunicipalityListViewModel[]
  totalDocs: number
  totalPages: number
  scopeTotal: number
  filterFacets: MunicipalityListFilterFacets
  /** B155 — contact-name lookup for the chips of the município list rows. */
  leadershipNamesById: ReadonlyMap<number, MunicipalityLeadershipSummary>
}

const EMPTY_LEADERSHIP_NAMES: ReadonlyMap<number, MunicipalityLeadershipSummary> = new Map()

const emptyMunicipalityListFilterFacets: MunicipalityListFilterFacets = {
  slugs: [],
  regions: [],
  advisorIDs: [],
  stateDeputyIDs: [],
  leadershipOptions: [],
  parties: [],
}

type MunicipalityFacetRow = Pick<
  Municipality,
  'id' | 'slug' | 'region' | 'advisors' | 'stateDeputies'
>

/**
 * E10's class filter is the only one that isn't a Payload constraint (the
 * class is derived from the committed TSE artifact, not stored), so every
 * place that would otherwise trust `where` — the page query and the facets —
 * has to apply this predicate itself. Returns `null` when no class is selected,
 * which is also the signal to keep the cheap database-paginated path.
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
  relationCatalog: MunicipalityListRelationCatalog,
  /** The scope read is a PROMISE so the facets can join the page's main `Promise.all` (B16+). */
  loadedScope: { where: Where; rows: Promise<MunicipalityFacetRow[]> } | null,
): Promise<MunicipalityListFilterFacets> => {
  // No facet popover owns the class filter, so every facet read keeps it
  // applied — inside the memo, so a `where` shared by two facets is filtered once.
  const classMatches = territorialClassFilterPredicate(state)
  const applyClassFilter = (rows: MunicipalityFacetRow[]): MunicipalityFacetRow[] =>
    classMatches ? rows.filter((row) => classMatches(row.slug)) : rows

  // Dobradinha links are stored on the rows; a deputy id → party inverse comes
  // from the request-scoped catalog, so the Partido facet never re-queries.
  const partyOfStateDeputyID = new Map<number, string>()
  for (const [party, stateDeputyIDs] of relationCatalog.stateDeputyIDsByParty) {
    for (const id of stateDeputyIDs) partyOfStateDeputyID.set(id, party)
  }

  const rowsByWhere = new Map<string, Promise<MunicipalityFacetRow[]>>()
  if (loadedScope) {
    rowsByWhere.set(JSON.stringify(loadedScope.where), loadedScope.rows.then(applyClassFilter))
  }
  const facetRows = (omit: Partial<MunicipalityListState>): Promise<MunicipalityFacetRow[]> => {
    const where = buildMunicipalityListWhere({ ...state, ...omit }, relationCatalog)
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
        select: { id: true, slug: true, region: true, advisors: true, stateDeputies: true },
        user,
        overrideAccess: false,
      })
      .then((result) => applyClassFilter(result.docs as MunicipalityFacetRow[]))
    rowsByWhere.set(key, rows)
    return rows
  }

  // Named selections are unioned in: a selection must stay visible to be undone.
  const selectedStateDeputyIDs = new Set<number>()
  for (const value of state.stateDeputies ?? []) {
    if (typeof value === 'number') selectedStateDeputyIDs.add(value)
  }
  const selectedLeadershipIDs = new Set<number>()
  for (const value of state.leaderships ?? []) {
    if (typeof value === 'number') selectedLeadershipIDs.add(value)
  }
  const selectedParties = new Set(
    (state.parties ?? []).filter((party) => party !== NO_PARTY_FILTER_VALUE),
  )

  const [slugRows, regionRows, advisorRows, stateDeputyRows, leadershipRows, partyRows] =
    await Promise.all([
      facetRows({ slugs: undefined, priority: undefined }),
      facetRows({ regions: undefined }),
      facetRows({ advisors: undefined, coverage: undefined }),
      facetRows({ stateDeputies: undefined }),
      facetRows({ leaderships: undefined }),
      facetRows({ parties: undefined }),
    ])

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

  const availableStateDeputyIDs = new Set<number>(selectedStateDeputyIDs)
  for (const row of stateDeputyRows) {
    for (const stateDeputy of row.stateDeputies ?? []) {
      const id = relationshipId(stateDeputy)
      if (id !== null) availableStateDeputyIDs.add(id)
    }
  }

  const availableParties = new Set<string>(selectedParties)
  for (const row of partyRows) {
    for (const stateDeputy of row.stateDeputies ?? []) {
      const id = relationshipId(stateDeputy)
      if (id === null) continue
      const party = partyOfStateDeputyID.get(id)
      if (party) availableParties.add(party)
    }
  }

  // Leaderships of the facet's own row set: the reverse read returns the ids
  // plus the contact names the filter chips need (honours `canReadLeadership`).
  const facetLeadershipRows = await loadMunicipalityLeadershipSummaries(
    payload,
    user,
    leadershipRows.map((row) => row.id),
  )
  const leadershipNamesById = new Map(facetLeadershipRows.summariesById)
  for (const leadershipID of selectedLeadershipIDs) {
    const summary = leadershipNamesById.get(leadershipID)
    if (!summary) {
      // A selected leadership that the reversed read cannot see (deleted or
      // scoped out) stays listed so the filter can be undone.
      leadershipNamesById.set(leadershipID, {
        id: leadershipID,
        name: `Liderança #${leadershipID}`,
      })
    }
  }
  const availableLeadershipIDs = new Set<number>(selectedLeadershipIDs)
  for (const leadershipID of leadershipNamesById.keys()) availableLeadershipIDs.add(leadershipID)

  return {
    slugs: municipalityCatalog
      .filter((entry) => availableSlugs.has(entry.slug))
      .map((entry) => entry.slug),
    regions: bahiaIdentityTerritories.filter((territory) => availableRegions.has(territory)),
    advisorIDs: [...availableAdvisorIDs].sort((left, right) => left - right),
    stateDeputyIDs: [...availableStateDeputyIDs].sort((left, right) => left - right),
    leadershipOptions: [...availableLeadershipIDs]
      .sort((left, right) => left - right)
      .map((id) => leadershipNamesById.get(id)!),
    parties: [...availableParties].sort((left, right) => left.localeCompare(right, 'pt-BR')),
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
  /** B178 — city aggregate class override (the artifact lookup by slug would miss). */
  classBySlug?: ReadonlyMap<string, MunicipalityTerritorialClassification>
  /** B178 — the virtual city row: inserted at its native-sort position. */
  citySlug?: string
}

const applyDerivedMunicipalitySort = (
  docs: Municipality[],
  sortKey: MunicipalityListSortKey,
  dir: MunicipalityListSortDirection,
  {
    ranks,
    goalCoverageByMunicipalityID,
    pledgeAggregates,
    classBySlug,
    citySlug,
  }: DerivedSortContext,
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
          territorialClassSortWeight[
            (
              classBySlug?.get(municipality.slug) ??
              computeMunicipalityTerritorialClass(municipality.slug)
            ).class
          ],
      )
    default:
      // Native keys reach here when a derived FILTER forced the in-memory
      // path; the query already sorted them, so the order is preserved — with
      // one exception: the virtual city row never passed through SQL, so it is
      // inserted at its own position without re-sorting the DB docs.
      if (!citySlug) return docs
      const city = docs.find((doc) => doc.slug === citySlug)
      if (!city) return docs
      return insertCityAtNativeSortPosition(
        docs.filter((doc) => doc !== city),
        city,
        sortKey,
        dir,
      )
  }
}

export const loadMunicipalityListPageBundle = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: MunicipalityListSearchParams,
): Promise<MunicipalityListPageBundle> => {
  const state = parseMunicipalityListParams(searchParams)
  const isStaff = isCampaignStaff(user)
  const isUnrestricted = isCampaignUnrestricted(user)
  const { sort: sortKey, dir: sortDir } = resolveMunicipalityListSort(state)

  if (isCampaignLeader(user)) {
    return {
      municipalities: [],
      totalDocs: 0,
      totalPages: 0,
      scopeTotal: 0,
      filterFacets: emptyMunicipalityListFilterFacets,
      leadershipNamesById: EMPTY_LEADERSHIP_NAMES,
    }
  }

  // B176 — one request-scoped catalog for every where build (page + facets):
  // the reverse (`leadership`) and cross (`party`) filters read it. Lazy per
  // active filter, so a plain list visit pays no extra reads.
  const relationCatalog = await loadMunicipalityListRelationCatalog(payload, user, state)
  const where = buildMunicipalityListWhere(state, relationCatalog)

  const ranks = computeVoteRankByYear(DEFAULT_VOTE_RANK_YEAR)
  const nativeSortField = payloadSortFieldByKey[sortKey]
  const classMatches = territorialClassFilterPredicate(state)
  // B178 — the Salvador city row behaves like a normal entity: it is selected
  // by the same filters that would select a municipality with its virtual
  // values. Advisors only see it when they explicitly search for the city
  // (their portfolio is per-ZE and the city is not administered by anyone);
  // coordinator/candidate see it in any recorte that selects it.
  const cityInRecorte = cityMatchesFilter(state) && (isUnrestricted || Boolean(state.q))
  // A derived filter can't be expressed in `where`, so it forces the
  // load-everything path even when the SORT itself is native — otherwise the
  // page would drop rows out of a 25-row window and `totalDocs` would count
  // municípios the filter excludes. The virtual city row can never ride the
  // SQL page either: it only exists in memory.
  const isPagedByPayload = nativeSortField !== undefined && !classMatches && !cityInRecorte

  // B178 — two rank views of the same 435-unit table: the sort ranks carry the
  // city's summed votes (so `votos` orders it by its real total), the row
  // ranks carry the city's COMPETITIVE entry ("12º de 663") when the year has
  // one — without it the column renders its dash instead of a fake rank.
  let sortRanks: ReadonlyMap<string, MunicipalityVoteRankEntry> = ranks
  let rowRanks: ReadonlyMap<string, MunicipalityVoteRankEntry> = ranks
  if (cityInRecorte) {
    const mergedSort = new Map(ranks)
    mergedSort.set(SALVADOR_CITY_SLUG, citySortVoteEntry())
    sortRanks = mergedSort
    const mergedRows = new Map(ranks)
    const cityEntry = cityVoteRankEntry()
    if (cityEntry) mergedRows.set(SALVADOR_CITY_SLUG, cityEntry)
    rowRanks = mergedRows
  }
  const classBySlug: ReadonlyMap<string, MunicipalityTerritorialClassification> | undefined =
    cityInRecorte ? new Map([[SALVADOR_CITY_SLUG, cityTerritorialClass()]]) : undefined

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
    ? isPagedByPayload
      ? loadMunicipalityScope(payload, user, where, {
          // B176 — the paged path seeds the facet memo from these scope rows,
          // and the Dobradinha/Partido facets read `stateDeputies` off them.
          // Without the widened select those option groups render empty under
          // a native sort (the cache key separates the widened call — P3-E).
          extraSelect: { stateDeputies: true },
        })
      : listQuery.then((result) =>
          loadMunicipalityScopeFromDocs(payload, result.docs as Municipality[]),
        )
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
      relationCatalog,
      isStaff
        ? { where, rows: staffScopePromise.then((scope) => scope?.municipalities ?? []) }
        : null,
    ),
    // Result discarded on purpose: the `campaignGoals` read below is
    // `cache()`-deduplicated, so starting it here moves it off the tail of the
    // request instead of adding a round trip after everything else resolved.
    isStaff ? loadStatewideSuggestedGoals(payload, user) : null,
  ])

  // B178 — the city slug joins the name-filter options whenever the recorte
  // shows the city row, so the filter can be applied/undone like any other.
  if (cityInRecorte && !filterFacets.slugs.includes(SALVADOR_CITY_SLUG)) {
    filterFacets.slugs = [...filterFacets.slugs, SALVADOR_CITY_SLUG]
  }

  let pledgeAggregates = new Map<number, MunicipalityPledgeAggregate>()
  let goalCoverageByMunicipalityID = new Map<
    number,
    Record<VoteEstimateScenario, MunicipalityGoalCoverage>
  >()

  if (staffScope) {
    pledgeAggregates = staffScope.pledgeAggregates
    const scopedMunicipalities = classMatches
      ? staffScope.municipalities.filter((municipality) => classMatches(municipality.slug))
      : staffScope.municipalities
    const goalCoverageBundle = await loadMunicipalityGoalCoverageBundle(
      payload,
      user,
      scopedMunicipalities,
      pledgeAggregates,
    )
    goalCoverageByMunicipalityID = goalCoverageBundle.coverageByMunicipalityID
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
    // B178 — the city row joins the in-memory recorte and enters the sort with
    // its virtual values; native sorts position it explicitly.
    // (`cityMatchesFilter` already rejected the city when the class filter
    // excludes its aggregate class, so nothing extra to check here.)
    const cityDoc = cityInRecorte ? buildCityMunicipalityDoc() : null
    const allDocs = applyDerivedMunicipalitySort(
      cityDoc ? [...scopedDocs, cityDoc] : scopedDocs,
      sortKey,
      sortDir,
      {
        ranks: sortRanks,
        goalCoverageByMunicipalityID,
        pledgeAggregates,
        classBySlug,
        citySlug: cityDoc ? SALVADOR_CITY_SLUG : undefined,
      },
    )
    totalDocs = allDocs.length
    totalPages = Math.max(1, Math.ceil(totalDocs / municipalityPageSize))
    const start = (state.page - 1) * municipalityPageSize
    pageDocs = allDocs.slice(start, start + municipalityPageSize)
  }

  // B155 — the leaderships of the visible page only (staff surfaces; the
  // leader view already returned above). One reverse batch: ids per município
  // for the rows, contact names for the chips.
  const [leadershipBundle, lastUpdatesByMunicipalityID] = await Promise.all([
    isStaff
      ? loadMunicipalityLeadershipSummaries(
          payload,
          user,
          pageDocs.map((municipality) => municipality.id),
        )
      : null,
    isStaff
      ? loadMunicipalityLastUpdates(
          payload,
          user,
          pageDocs.map((d) => d.id),
        )
      : new Map(),
  ])

  return {
    municipalities: pageDocs.map((municipality) => {
      const isCity = municipality.slug === SALVADOR_CITY_SLUG
      return toMunicipalityListViewModel(
        municipality,
        isStaff ? pledgeAggregates.get(municipality.id) : undefined,
        rowRanks.get(municipality.slug) ?? null,
        isStaff ? goalCoverageByMunicipalityID.get(municipality.id) : undefined,
        leadershipBundle?.leadershipIDsByMunicipality.get(municipality.id) ?? [],
        isCity,
        isCity ? classBySlug?.get(SALVADOR_CITY_SLUG) : undefined,
        lastUpdatesByMunicipalityID.get(municipality.id) ?? null,
      )
    }),
    totalDocs,
    totalPages,
    scopeTotal: scopeCount.totalDocs,
    filterFacets,
    leadershipNamesById: leadershipBundle?.summariesById ?? EMPTY_LEADERSHIP_NAMES,
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
