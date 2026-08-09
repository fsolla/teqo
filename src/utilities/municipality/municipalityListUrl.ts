/**
 * Municipality list URL contract: state type, param parsing/canonicalization,
 * Payload `where`, serialization and sort. Split out of the former
 * `municipalityUi.ts` in Pass 2 W1. The URL contract is frozen — B18 (saved
 * filters) depends on it.
 */
import type { Where } from 'payload'

import { type BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { engagementLevels, type EngagementLevel } from '@/lib/engagementLevel'
import { isMunicipalitySlug } from '@/lib/municipalityCatalog'
import { isCitySlug } from '@/lib/salvadorCity'
import {
  allParamValues,
  buildListHref,
  collapseListWhereOrBranches,
  createSortToggleHref,
  firstValue,
  NO_PARTY_FILTER_VALUE,
  normalizedText,
  parseExhaustiveEnumParam,
  resolveListUrl,
  splitAbsenceFilterValues,
  strictDecimalInteger,
  type RawSearchParams as CampaignListRawSearchParams,
} from '@/utilities/campaignListUrl'
import {
  politicalTrendLabels,
  territorialClassLabels,
  type MunicipalityListColumnId,
  type PoliticalTrendStatus,
} from '@/utilities/municipality/municipalityLabels'
import type { MunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'
import { parseTerritoryRegionsParam } from '@/utilities/territory/territoryRegionParam'

export const municipalityPageSize = 25

export type MunicipalityListSortKey =
  | 'name'
  | 'region'
  | 'trend'
  | 'expectedVotes'
  | 'lastUpdateAt'
  | 'coverage'
  | 'votos'
  | 'deficit'
  | 'frescor'
  | 'classe'
  | 'nivel'

export type MunicipalityListSortDirection = 'asc' | 'desc'

/**
 * E14 filter values: the five levels plus the absence of one. "Sem nível" is
 * a real answer here — it is the triage queue — so it is a selectable value
 * and not the empty selection.
 *
 * Same sentinel convention as `NO_PARTY_FILTER_VALUE` in `stateDeputyListUrl`
 * (second call site; a third should extract the pair sentinel + `exists: false`
 * branch). Unlike `party`, the level is a closed enum, so it also gets the
 * "all selected → absent" canonicalization of `parseExhaustiveEnumParam`.
 */
export const NO_LEVEL_FILTER_VALUE = 'sem_nivel'

export type MunicipalityListLevelFilterValue = EngagementLevel | typeof NO_LEVEL_FILTER_VALUE

export const municipalityListLevelFilterValues: readonly MunicipalityListLevelFilterValue[] = [
  ...engagementLevels,
  NO_LEVEL_FILTER_VALUE,
]

/**
 * Sentinel for the "Sem dobradinha" filter row: the municipality↔dobradinha
 * link is a hasMany relationship (`municipality.stateDeputies`), so absence is
 * `stateDeputies: { exists: false }` — the same pair (reserved token + absence
 * branch) as `NO_LEVEL_FILTER_VALUE` and `NO_PARTY_FILTER_VALUE`.
 */
export const NO_STATE_DEPUTY_FILTER_VALUE = 'sem_dobradinha'

/**
 * Sentinel for the "Sem liderança" filter row. The link is reverse
 * (`leadership.municipalities`), so absence is expressed as "municipality not
 * linked to ANY leadership in the actor's scope" — see
 * `MunicipalityListRelationCatalog.allLeadershipMunicipalityIDs`.
 */
export const NO_LEADERSHIP_FILTER_VALUE = 'sem_lideranca'

type MunicipalityListStateDeputyFilterValue = number | typeof NO_STATE_DEPUTY_FILTER_VALUE

type MunicipalityListLeadershipFilterValue = number | typeof NO_LEADERSHIP_FILTER_VALUE

/**
 * E9 allocation queue: the list opens on the decision it exists to serve —
 * where the goal is least covered by auditable commitments (biggest deficit
 * first), in the `central` scenario. Since E9 anchored the suggested goal on
 * the candidate's own 2022 vote, this ordering stays close to the previous
 * `votos` default instead of surfacing deserts with inflated goals.
 */
const DEFAULT_MUNICIPALITY_LIST_SORT_KEY: MunicipalityListSortKey = 'deficit'

export const municipalityListSortLabels: Record<MunicipalityListSortKey, string> = {
  name: 'Município',
  region: 'Território',
  trend: 'Tendência',
  expectedVotes: 'Votos estimados',
  lastUpdateAt: 'Última atualização',
  /** Sorts the "Assessores" column — "Cobertura" alone now reads as the goal one (`deficit`). */
  coverage: 'Assessores',
  /** Short header — definition lives on hover (`formatMunicipalityConcentrationHint`). */
  votos: '2022',
  deficit: 'Cobertura',
  frescor: 'Frescor do sinal',
  classe: 'Classe',
  nivel: 'Nível',
}

/**
 * B17 — the name each column answers to in the column picker. Nine of the
 * eleven quote the sort label, and the header renders that same record
 * (`MunicipalitySortableHead` falls back to it when given no children, which
 * is why those heads pass none), so renaming a header renames the menu entry
 * with it. The two that differ do so on purpose: a header sits above its own
 * data and can be telegraphic, while the same word alone in a list of column
 * names says nothing. `lastSignal` is read back by the header it names.
 */
export const municipalityColumnLabels: Record<MunicipalityListColumnId, string> = {
  name: municipalityListSortLabels.name,
  /** Header is the bare year, under the "2022" group of the table. */
  votos: 'Votação 2022',
  expectedVotes: 'Estimativa 2026',
  level: municipalityListSortLabels.nivel,
  classe: municipalityListSortLabels.classe,
  advisors: 'Assessor',
  trend: municipalityListSortLabels.trend,
  leaderships: 'Liderança',
  stateDeputies: 'Dobradinha',
  goalCoverage: municipalityListSortLabels.deficit,
  /** The column shows the signal; `frescor` sorts by how old it is. */
  lastSignal: 'Atualização',
  lastUpdateAt: municipalityListSortLabels.lastUpdateAt,
}

export type MunicipalityListState = {
  page: number
  q?: string
  /** Multi-select (OR) identity territories. */
  regions?: BahiaIdentityTerritory[]
  /** Multi-select (OR) catalog slugs. */
  slugs?: string[]
  /** Multi-select (OR) campaignUser advisor IDs. */
  advisors?: number[]
  coverage?: 'com_assessor' | 'sem_assessor'
  priority?: 'alta'
  /**
   * Multi-select (OR) political trends. Never holds the full set: "todas" is
   * encoded as absent, canonicalized by `parseMunicipalityListParams`.
   */
  trends?: PoliticalTrendStatus[]
  /**
   * Multi-select (OR) E10 territorial classes. Derived from the committed TSE
   * artifact, so — unlike every filter above — it is NOT part of
   * `buildMunicipalityListWhere`: `municipalityPageData` applies it in memory.
   * Never holds the full set (same "todas" canonicalization as `trends`).
   */
  classes?: MunicipalityTerritorialClass[]
  /**
   * Multi-select (OR) E14 engagement levels, including "sem nível". Stored,
   * so unlike `classes` this one IS part of `buildMunicipalityListWhere`.
   * Never holds the full set (same "todos" canonicalization as `trends`).
   */
  levels?: MunicipalityListLevelFilterValue[]
  /**
   * Multi-select (OR) B176 — stateDeputy ids linked to the município, plus the
   * "Sem dobradinha" sentinel. Direct relationship (`municipality.stateDeputies`),
   * so unlike `leaderships`/`parties` it needs no precomputed catalog.
   */
  stateDeputies?: MunicipalityListStateDeputyFilterValue[]
  /**
   * Multi-select (OR) B176 — leadership ids acting in the município, plus the
   * "Sem liderança" sentinel. Reverse relationship (`leadership.municipalities`),
   * so `buildMunicipalityListWhere` derives the municipality-id set from the
   * request-scoped `MunicipalityListRelationCatalog`.
   */
  leaderships?: MunicipalityListLeadershipFilterValue[]
  /**
   * Multi-select (OR) B176 — party names of the município's dobradinhas, plus
   * `NO_PARTY_FILTER_VALUE`. Needs the party→deputy-id lookup in the catalog.
   */
  parties?: string[]
  /** Candidate number for the map comparison mode (does not filter the list). */
  compare?: number
  sort?: MunicipalityListSortKey
  dir?: MunicipalityListSortDirection
}

/**
 * B176 — the request-scoped relation sets `buildMunicipalityListWhere` needs to
 * turn the reverse (`leadership.municipalities`) and cross (`stateDeputy.party`)
 * filters into municipality-level `where` clauses. State-independent, so a page
 * or the map loads it ONCE and the pure where-builder derives per-state branches.
 */
export type MunicipalityListRelationCatalog = {
  /** Scoped leadership id → municipality ids it acts in (the actor's read scope). */
  leadershipMunicipalityIDsByLeadership: ReadonlyMap<number, readonly number[]>
  /** Municipality ids linked to ANY scoped leadership — for "Sem liderança". */
  allLeadershipMunicipalityIDs: ReadonlySet<number>
  /** Party name → stateDeputy ids carrying it — for named party filters. */
  stateDeputyIDsByParty: ReadonlyMap<string, readonly number[]>
  /** StateDeputy ids that carry any party — for "Sem partido". */
  allPartyStateDeputyIDs: ReadonlySet<number>
}

export type MunicipalityListSearchParams = CampaignListRawSearchParams

const municipalityListParamNames = [
  'q',
  'region',
  'slug',
  'advisor',
  'coverage',
  'priority',
  'trend',
  'class',
  'level',
  'stateDeputy',
  'leadership',
  'party',
  'compare',
  'sort',
  'dir',
  'page',
] as const

const municipalityListParamNameSet = new Set<string>(municipalityListParamNames)

// Derived from the label record (total over the union), so a new sort key is
// declared in the type and the labels only.
const municipalityListSortKeySet = new Set<string>(Object.keys(municipalityListSortLabels))

const municipalityListSortDirSet = new Set<MunicipalityListSortDirection>(['asc', 'desc'])

const sortKeysWithDescDefault: MunicipalityListSortKey[] = [
  'expectedVotes',
  'lastUpdateAt',
  'votos',
  // Both open on the worst case: biggest uncovered deficit, coldest signal.
  'deficit',
  'frescor',
  // Ordinal, not alphabetical: descending means reduto first.
  'classe',
  // Ordinal too: descending opens on N4, where the campaign is most invested.
  'nivel',
]

export const defaultMunicipalityListSortDir = (
  key: MunicipalityListSortKey,
): MunicipalityListSortDirection => (sortKeysWithDescDefault.includes(key) ? 'desc' : 'asc')

export const resolveMunicipalityListSort = (
  state: MunicipalityListState,
): { sort: MunicipalityListSortKey; dir: MunicipalityListSortDirection } => {
  const sort = state.sort ?? DEFAULT_MUNICIPALITY_LIST_SORT_KEY
  const dir = state.dir ?? defaultMunicipalityListSortDir(sort)
  return { sort, dir }
}

export const isDefaultMunicipalityListSort = (state: MunicipalityListState): boolean => {
  const { sort, dir } = resolveMunicipalityListSort(state)
  return sort === DEFAULT_MUNICIPALITY_LIST_SORT_KEY && dir === defaultMunicipalityListSortDir(sort)
}

export const formatMunicipalityListSortSummary = (
  sort: MunicipalityListSortKey,
  dir: MunicipalityListSortDirection,
): string => {
  if (sort === 'votos') {
    return dir === 'desc' ? 'Ordenado por 2022 ↓' : 'Ordenado por 2022 ↑'
  }
  if (sort === 'name') {
    return dir === 'asc' ? 'Ordenado por nome (A–Z)' : 'Ordenado por nome (Z–A)'
  }
  if (sort === 'deficit') {
    const label = municipalityListSortLabels.deficit
    return dir === 'desc'
      ? `Ordenado por ${label} (maior déficit primeiro)`
      : `Ordenado por ${label} (menor déficit primeiro)`
  }
  if (sort === 'frescor') {
    return dir === 'desc'
      ? 'Ordenado por frescor (sinal mais frio primeiro)'
      : 'Ordenado por frescor (sinal mais recente primeiro)'
  }
  if (sort === 'classe') {
    return dir === 'desc'
      ? 'Ordenado por classe (reduto primeiro)'
      : 'Ordenado por classe (marginal primeiro)'
  }
  if (sort === 'nivel') {
    return dir === 'desc' ? 'Ordenado por nível (N4 primeiro)' : 'Ordenado por nível (N0 primeiro)'
  }
  const label = municipalityListSortLabels[sort]
  return dir === 'desc' ? `Ordenado por ${label} ↓` : `Ordenado por ${label} ↑`
}

const parseRegionsParam = parseTerritoryRegionsParam

/**
 * B178 — the municipality list also accepts the virtual city slug (`salvador`):
 * the city row participates in the slug filter like a normal entity. Deliberately
 * list-scoped: `isMunicipalitySlug` (the global catalog) stays untouched.
 */
const isMunicipalityOrCitySlug = (value: string): boolean =>
  isMunicipalitySlug(value) || isCitySlug(value)

const parseSlugsParam = (raw: string | string[] | undefined): string[] => {
  const slugs: string[] = []
  const seen = new Set<string>()
  for (const token of allParamValues(raw)) {
    if (!isMunicipalityOrCitySlug(token) || seen.has(token)) continue
    seen.add(token)
    slugs.push(token)
  }
  return slugs
}

const parseAdvisorsParam = (raw: string | string[] | undefined): number[] => {
  const advisors: number[] = []
  const seen = new Set<number>()
  for (const token of allParamValues(raw)) {
    const id = strictDecimalInteger(token)
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    advisors.push(id)
  }
  return advisors.sort((left, right) => left - right)
}

/**
 * B176 — a relationship multi-select whose absence is a reserved sentinel token
 * (`sem_dobradinha` / `sem_lideranca`): integer ids sort ascending and the
 * sentinel rides last, so one value set canonicalizes to one URL. Also the
 * canonicalizer the fast-path toggle (`buildMunicipalityFilterOptionHref`) uses.
 */
export const canonicalRelationshipWithAbsenceValues = <Sentinel extends string>(
  raw: string | string[] | undefined,
  sentinel: Sentinel,
): Array<number | Sentinel> => {
  const ids: number[] = []
  const seen = new Set<number>()
  let hasAbsence = false
  for (const token of allParamValues(raw)) {
    if (token === sentinel) {
      hasAbsence = true
      continue
    }
    const id = strictDecimalInteger(token)
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return [...ids.sort((left, right) => left - right), ...(hasAbsence ? [sentinel] : [])]
}

const parseStateDeputiesParam = (
  raw: string | string[] | undefined,
): MunicipalityListStateDeputyFilterValue[] =>
  canonicalRelationshipWithAbsenceValues(raw, NO_STATE_DEPUTY_FILTER_VALUE)

const parseLeadershipsParam = (
  raw: string | string[] | undefined,
): MunicipalityListLeadershipFilterValue[] =>
  canonicalRelationshipWithAbsenceValues(raw, NO_LEADERSHIP_FILTER_VALUE)

/**
 * B176 — party values canonicalize the same way the relationship dims do:
 * named parties keep first-seen order (deduped, ≤32 chars) and the "Sem
 * partido" sentinel rides last, so one value set maps to one URL. Shared by
 * the URL parser and the fast-path toggle so both writers agree.
 */
export const canonicalPartyValues = (values: readonly string[]): string[] => {
  const named: string[] = []
  const seen = new Set<string>()
  let hasAbsence = false
  for (const value of values) {
    if (value === NO_PARTY_FILTER_VALUE) {
      hasAbsence = true
      continue
    }
    if (seen.has(value) || value.length > 32) continue
    seen.add(value)
    named.push(value)
  }
  return [...named, ...(hasAbsence ? [NO_PARTY_FILTER_VALUE] : [])]
}

const parsePartiesParam = (raw: string | string[] | undefined): string[] =>
  canonicalPartyValues(allParamValues(raw))

const politicalTrendStatusSet = new Set<string>(Object.keys(politicalTrendLabels))
const territorialClassSet = new Set<string>(Object.keys(territorialClassLabels))
const engagementLevelFilterSet = new Set<string>(municipalityListLevelFilterValues)

export const municipalityListStateToRawParams = (
  state: MunicipalityListState,
  page = state.page,
): MunicipalityListSearchParams => ({
  page: String(page),
  q: state.q,
  region: state.regions,
  slug: state.slugs,
  advisor: state.advisors?.map(String),
  coverage: state.coverage,
  priority: state.priority,
  trend: state.trends,
  class: state.classes,
  level: state.levels,
  stateDeputy: state.stateDeputies?.map(String),
  leadership: state.leaderships?.map(String),
  party: state.parties,
  compare: state.compare === undefined ? undefined : String(state.compare),
  sort: state.sort,
  dir: state.dir,
})

export const parseMunicipalityListParams = (
  params: MunicipalityListSearchParams,
): MunicipalityListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const regions = parseRegionsParam(params.region)
  const slugs = parseSlugsParam(params.slug)
  const advisors = parseAdvisorsParam(params.advisor)
  const rawCoverage = firstValue(params.coverage)
  const rawPriority = firstValue(params.priority)
  const trends = parseExhaustiveEnumParam<PoliticalTrendStatus>(
    params.trend,
    politicalTrendStatusSet,
  )
  const classes = parseExhaustiveEnumParam<MunicipalityTerritorialClass>(
    params.class,
    territorialClassSet,
  )
  const levels = parseExhaustiveEnumParam<MunicipalityListLevelFilterValue>(
    params.level,
    engagementLevelFilterSet,
  )
  const stateDeputies = parseStateDeputiesParam(params.stateDeputy)
  const leaderships = parseLeadershipsParam(params.leadership)
  const parties = parsePartiesParam(params.party)
  const rawCompare = strictDecimalInteger(firstValue(params.compare))
  const rawSort = firstValue(params.sort) as MunicipalityListSortKey | undefined
  const sort = rawSort && municipalityListSortKeySet.has(rawSort) ? rawSort : undefined
  const rawDir = firstValue(params.dir) as MunicipalityListSortDirection | undefined
  const dir = rawDir && municipalityListSortDirSet.has(rawDir) ? rawDir : undefined

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(regions.length ? { regions } : {}),
    ...(slugs.length ? { slugs } : {}),
    ...(advisors.length ? { advisors } : {}),
    ...(rawCoverage === 'com_assessor' || rawCoverage === 'sem_assessor'
      ? { coverage: rawCoverage }
      : {}),
    ...(rawPriority === 'alta' ? { priority: 'alta' } : {}),
    ...(trends.length ? { trends } : {}),
    ...(classes.length ? { classes } : {}),
    ...(levels.length ? { levels } : {}),
    ...(stateDeputies.length ? { stateDeputies } : {}),
    ...(leaderships.length ? { leaderships } : {}),
    ...(parties.length ? { parties } : {}),
    ...(rawCompare && rawCompare <= 99999 ? { compare: rawCompare } : {}),
    ...(sort ? { sort } : {}),
    ...(dir ? { dir } : {}),
  }
}

export const buildMunicipalityListWhere = (
  state: MunicipalityListState,
  relationCatalog?: MunicipalityListRelationCatalog,
): Where => {
  const filters: Where[] = []
  const searchedZone = strictDecimalInteger(state.q)

  if (state.q) {
    const searchFilters: Where[] = [{ name: { contains: state.q } }]
    if (searchedZone && searchedZone <= 999) {
      searchFilters.push({ zoneNumber: { equals: searchedZone } })
    }
    filters.push({ or: searchFilters })
  }
  if (state.regions?.length) filters.push({ region: { in: state.regions } })
  if (state.slugs?.length) filters.push({ slug: { in: state.slugs } })
  if (state.advisors?.length) filters.push({ advisors: { in: state.advisors } })
  if (state.coverage) {
    filters.push({
      advisors: { exists: state.coverage === 'com_assessor' },
    })
  }
  if (state.priority) filters.push({ priority: { equals: state.priority } })
  if (state.trends?.length) filters.push({ 'politicalTrend.status': { in: state.trends } })
  if (state.levels?.length) {
    // "Sem nível" is absence, which no `in` can express — it rides along as an
    // OR branch so "N0 ou sem nível" (the triage view) is one query.
    const { named: selectedLevels, hasAbsence } = splitAbsenceFilterValues(
      state.levels,
      (level) => level === NO_LEVEL_FILTER_VALUE,
    )
    const levelFilters: Where[] = []
    if (selectedLevels.length) levelFilters.push({ engagementLevel: { in: selectedLevels } })
    if (hasAbsence) levelFilters.push({ engagementLevel: { exists: false } })
    const branch = collapseListWhereOrBranches(levelFilters)
    if (branch) filters.push(branch)
  }

  // --- B176: dobradinha (direct relationship) --------------------------------
  if (state.stateDeputies?.length) {
    const { named: selectedStateDeputies, hasAbsence } = splitAbsenceFilterValues(
      state.stateDeputies,
      (value) => value === NO_STATE_DEPUTY_FILTER_VALUE,
    )
    const stateDeputyFilters: Where[] = []
    if (selectedStateDeputies.length) {
      stateDeputyFilters.push({ stateDeputies: { in: selectedStateDeputies } })
    }
    if (hasAbsence) stateDeputyFilters.push({ stateDeputies: { exists: false } })
    const branch = collapseListWhereOrBranches(stateDeputyFilters)
    if (branch) filters.push(branch)
  }

  // --- B176: leadership (reverse relation — needs the catalog) --------------
  if (state.leaderships?.length) {
    assertMunicipalityRelationCatalog(state.leaderships, relationCatalog)
    const { named: selectedLeaderships, hasAbsence } = splitAbsenceFilterValues(
      state.leaderships,
      (value) => value === NO_LEADERSHIP_FILTER_VALUE,
    )
    const leadershipFilters: Where[] = []
    if (selectedLeaderships.length) {
      leadershipFilters.push({
        id: {
          in: unionSortedIDsFrom(
            relationCatalog.leadershipMunicipalityIDsByLeadership,
            selectedLeaderships.filter((id): id is number => typeof id === 'number'),
          ),
        },
      })
    }
    if (hasAbsence) {
      leadershipFilters.push({ id: { not_in: [...relationCatalog.allLeadershipMunicipalityIDs] } })
    }
    const branch = collapseListWhereOrBranches(leadershipFilters)
    if (branch) filters.push(branch)
  }

  // --- B176: partido da dobradinha (cross read — needs the catalog) ---------
  if (state.parties?.length) {
    assertMunicipalityRelationCatalog(state.parties, relationCatalog)
    const { named: namedParties, hasAbsence } = splitAbsenceFilterValues(
      state.parties,
      (party) => party === NO_PARTY_FILTER_VALUE,
    )
    const partyFilters: Where[] = []
    if (namedParties.length) {
      partyFilters.push({
        stateDeputies: {
          in: unionSortedIDsFrom(relationCatalog.stateDeputyIDsByParty, namedParties),
        },
      })
    }
    if (hasAbsence) {
      partyFilters.push({ stateDeputies: { not_in: [...relationCatalog.allPartyStateDeputyIDs] } })
    }
    const branch = collapseListWhereOrBranches(partyFilters)
    if (branch) filters.push(branch)
  }
  // `state.classes` is absent on purpose: the class is derived from the TSE
  // artifact, not stored, so it can't be a Payload constraint. `municipalityPageData`
  // filters it in memory over the unpaginated scope.

  return filters.length ? { and: filters } : {}
}

/**
 * Fail-closed: the reverse (`leadership`) and cross (`party`) filters can only
 * become a `where` with the request-scoped catalog. Dropping the filter
 * silently would hand back a WIDER recorte than the URL asked for.
 */
function assertMunicipalityRelationCatalog(
  values: readonly unknown[],
  relationCatalog: MunicipalityListRelationCatalog | undefined,
): asserts relationCatalog is MunicipalityListRelationCatalog {
  if (!relationCatalog) {
    throw new Error(
      `buildMunicipalityListWhere: missing relation catalog for the filter ${JSON.stringify(values)}`,
    )
  }
}

/** Union of the id lists behind each key, sorted ascending — the OR of a relation dimension. */
const unionSortedIDsFrom = <Key>(
  byKey: ReadonlyMap<Key, readonly number[]>,
  keys: readonly Key[],
): number[] =>
  [...new Set(keys.flatMap((key) => byKey.get(key) ?? []))].sort((left, right) => left - right)

/**
 * Serializes a state that is ALREADY canonical (came out of
 * `parseMunicipalityListParams`, or was derived from a canonical state by a
 * rule-preserving toggle). Kept private-ish so the public builder below stays
 * the only entry point that accepts arbitrary states.
 */
export const serializeCanonicalMunicipalityListSearchParams = (
  canonicalState: MunicipalityListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  const resolvedSort = canonicalState.sort ?? DEFAULT_MUNICIPALITY_LIST_SORT_KEY
  const resolvedDir = canonicalState.dir ?? defaultMunicipalityListSortDir(resolvedSort)
  const isListDefault =
    resolvedSort === DEFAULT_MUNICIPALITY_LIST_SORT_KEY &&
    resolvedDir === defaultMunicipalityListSortDir(DEFAULT_MUNICIPALITY_LIST_SORT_KEY)

  if (canonicalState.q) params.set('q', canonicalState.q)
  for (const region of canonicalState.regions ?? []) params.append('region', region)
  for (const slug of canonicalState.slugs ?? []) params.append('slug', slug)
  for (const advisor of canonicalState.advisors ?? []) params.append('advisor', String(advisor))
  if (canonicalState.coverage) params.set('coverage', canonicalState.coverage)
  if (canonicalState.priority) params.set('priority', canonicalState.priority)
  for (const trend of canonicalState.trends ?? []) params.append('trend', trend)
  for (const territorialClass of canonicalState.classes ?? []) {
    params.append('class', territorialClass)
  }
  for (const level of canonicalState.levels ?? []) params.append('level', level)
  for (const stateDeputy of canonicalState.stateDeputies ?? []) {
    params.append('stateDeputy', String(stateDeputy))
  }
  for (const leadership of canonicalState.leaderships ?? []) {
    params.append('leadership', String(leadership))
  }
  for (const party of canonicalState.parties ?? []) params.append('party', party)
  if (canonicalState.compare) params.set('compare', String(canonicalState.compare))
  // Omit the default pair (staff: deficit+desc). Keep `sort` whenever the pair
  // is non-default so `dir` is never orphaned (e.g. votos+asc → sort=votos&dir=asc).
  if (!isListDefault) {
    params.set('sort', resolvedSort)
    if (resolvedDir !== defaultMunicipalityListSortDir(resolvedSort)) {
      params.set('dir', resolvedDir)
    }
  }
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))

  return params
}

const buildMunicipalityListSearchParams = (
  state: MunicipalityListState,
  page = state.page,
): URLSearchParams =>
  serializeCanonicalMunicipalityListSearchParams(
    parseMunicipalityListParams(municipalityListStateToRawParams(state, page)),
  )

export const buildMunicipalityListHref = (state: MunicipalityListState, page: number): string =>
  buildListHref(state, buildMunicipalityListSearchParams, '/campanha/municipios', page)

export const buildMunicipalitySortHref = createSortToggleHref<
  MunicipalityListState,
  MunicipalityListSortKey
>({
  resolveCurrentSort: (state) => {
    const sort = state.sort ?? DEFAULT_MUNICIPALITY_LIST_SORT_KEY
    return { sort, dir: state.dir ?? defaultMunicipalityListSortDir(sort) }
  },
  defaultDir: defaultMunicipalityListSortDir,
  buildHref: (state) => buildMunicipalityListHref(state, 1),
})

const formatMunicipalitySortOptionLabel = (
  key: MunicipalityListSortKey,
  dir: MunicipalityListSortDirection,
): string => {
  const base = municipalityListSortLabels[key]
  if (key === 'expectedVotes' || key === 'votos') {
    return dir === 'asc' ? `${base} (menor → maior)` : `${base} (maior → menor)`
  }
  if (key === 'lastUpdateAt') {
    return dir === 'asc' ? `${base} (mais antiga)` : `${base} (mais recente)`
  }
  if (key === 'deficit') {
    return dir === 'asc' ? `${base} (mais coberta)` : `${base} (mais descoberta)`
  }
  if (key === 'frescor') {
    return dir === 'asc' ? `${base} (mais recente)` : `${base} (mais frio)`
  }
  if (key === 'classe') {
    return dir === 'asc' ? `${base} (marginal primeiro)` : `${base} (reduto primeiro)`
  }
  if (key === 'nivel') {
    return dir === 'asc' ? `${base} (N0 primeiro)` : `${base} (N4 primeiro)`
  }
  return dir === 'asc' ? `${base} (A–Z)` : `${base} (Z–A)`
}

export const municipalityListSortOptions = (
  Object.keys(municipalityListSortLabels) as MunicipalityListSortKey[]
).flatMap((key) => [
  { key, dir: 'asc' as const, label: formatMunicipalitySortOptionLabel(key, 'asc') },
  { key, dir: 'desc' as const, label: formatMunicipalitySortOptionLabel(key, 'desc') },
])

export const serializeMunicipalitySortValue = (
  key: MunicipalityListSortKey,
  dir: MunicipalityListSortDirection,
): string => `${key}|${dir}`

export const parseMunicipalitySortValue = (
  value: string,
): { key: MunicipalityListSortKey; dir: MunicipalityListSortDirection } | null => {
  const [rawKey, rawDir] = value.split('|')
  if (!municipalityListSortKeySet.has(rawKey as MunicipalityListSortKey)) return null
  if (!municipalityListSortDirSet.has(rawDir as MunicipalityListSortDirection)) return null
  return { key: rawKey as MunicipalityListSortKey, dir: rawDir as MunicipalityListSortDirection }
}

export const resolveMunicipalityListUrl = (
  params: MunicipalityListSearchParams,
  totalPages?: number,
): {
  state: MunicipalityListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: municipalityListParamNameSet,
    parse: parseMunicipalityListParams,
    buildSearchParams: buildMunicipalityListSearchParams,
    basePath: '/campanha/municipios',
    totalPages,
  })
