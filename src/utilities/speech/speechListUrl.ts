/**
 * Speech acervo URL contract (C154): state, param parse/canonicalize and
 * hrefs, same shape as `peopleListUrl`/`supporterUi` over the shared
 * `campaignListUrl` helpers. Facet enums are exhaustive (selecting every
 * member equals no filter); year/phase/municipality are data-driven and
 * validated structurally.
 */
import { parseAcervoSort, type AcervoSortKey } from '@/lib/acervoListSort'
import { ACERVO_SOURCE_INTERNET, parseAcervoSource } from '@/lib/acervoSource'
import { CAMPAIGN_COMMUNICATION_ACERVO } from '@/lib/campaignPaths'
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'
import {
  SPEECH_SCOPES,
  SPEECH_TOPICS,
  type SpeechScope,
  type SpeechTopic,
} from '@/lib/speechFacets'
import {
  allParamValues,
  buildListHref,
  firstValue,
  normalizedText,
  parseExhaustiveEnumParam,
  parseMunicipalityValues,
  parseYearValues,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const speechPageSize = 25

/**
 * C192 — search mode of the acervo. `termo` is the literal search (default,
 * never serialized so existing deep links stay byte-identical); `tema` asks the
 * semantic bridge for related terms. Kept as a single-value param, only
 * meaningful alongside `q`.
 */
export type SpeechSearchMode = 'termo' | 'tema'

/** Duration buckets are ranges over `durationSeconds`; `sem_duracao` is null. */
export const SPEECH_DURATION_BUCKETS = [
  { value: 'curta', label: 'Até 2 min' },
  { value: 'media', label: '2 a 5 min' },
  { value: 'longa', label: 'Mais de 5 min' },
  { value: 'sem_duracao', label: 'Sem duração' },
] as const

export type SpeechDurationBucket = (typeof SPEECH_DURATION_BUCKETS)[number]['value']

export const speechDurationLabels = Object.fromEntries(
  SPEECH_DURATION_BUCKETS.map(({ value, label }) => [value, label]),
) as Record<SpeechDurationBucket, string>

export const speechTopicLabels = Object.fromEntries(
  SPEECH_TOPICS.map(({ value, label }) => [value, label]),
) as Record<SpeechTopic, string>

export const speechScopeLabels = Object.fromEntries(
  SPEECH_SCOPES.map(({ value, label }) => [value, label]),
) as Record<SpeechScope, string>

export type SpeechListState = {
  /**
   * C216 — the web speeches source. Absent means the Câmara source; only the
   * exact `source=internet` value is recognized (fail-closed on the default).
   */
  source?: 'internet'
  page: number
  q?: string
  mode?: SpeechSearchMode
  years?: number[]
  topics?: SpeechTopic[]
  scopes?: SpeechScope[]
  /** Câmara-only facet: `phase` is ignored (and not serialized) for the web. */
  phases?: string[]
  municipalities?: number[]
  durations?: SpeechDurationBucket[]
  /** C216 — the web list ordering; the Câmara contract has no sort. */
  sort?: AcervoSortKey
}

/** Server-loaded filter options (years/phases present, cited municipalities). */
export type SpeechFilterOptions = {
  years: number[]
  phases: string[]
  municipalities: { value: string; label: string }[]
}

type RawSpeechListParams = RawSearchParams

const speechListParamNames = [
  // C216 — additive params of the web speeches source; the Câmara URL contract
  // keeps its bytes (they are never serialized without `source=internet`).
  'source',
  'q',
  'mode',
  'year',
  'topic',
  'scope',
  'phase',
  'municipality',
  'duration',
  'sort',
  'page',
] as const

const speechListParamNameSet = new Set<string>(speechListParamNames)
const speechTopicSet = new Set<string>(SPEECH_TOPICS.map(({ value }) => value))
const speechScopeSet = new Set<string>(SPEECH_SCOPES.map(({ value }) => value))
const speechDurationSet = new Set<string>(SPEECH_DURATION_BUCKETS.map(({ value }) => value))
const MAX_PHASE_LENGTH = 80

/** Only `tema` is meaningful; anything else (and `termo`) means the default. */
const parseSpeechSearchMode = (raw: string | string[] | undefined): SpeechSearchMode | undefined =>
  firstValue(raw) === 'tema' ? 'tema' : undefined

export const parseSpeechListParams = (params: RawSpeechListParams): SpeechListState => {
  // C216 — the web source is a dimension of the same contract. Unknown source
  // values fall back to the Câmara (fail-closed); the web source has no Fase
  // facet, so `phase` is ignored there instead of leaking into its canonical URL.
  const isWeb = parseAcervoSource(params) === 'internet'
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const rawQ = normalizedText(firstValue(params.q))
  const q = rawQ && isContactSearchQueryReady(rawQ) ? rawQ : undefined
  const mode = parseSpeechSearchMode(params.mode)
  const years = parseYearValues(params.year)
  const topics = parseExhaustiveEnumParam<SpeechTopic>(params.topic, speechTopicSet)
  const scopes = parseExhaustiveEnumParam<SpeechScope>(params.scope, speechScopeSet)
  const phases = isWeb
    ? []
    : allParamValues(params.phase).filter((token) => token.length <= MAX_PHASE_LENGTH)
  const municipalities = parseMunicipalityValues(params.municipality)
  const durations = parseExhaustiveEnumParam<SpeechDurationBucket>(
    params.duration,
    speechDurationSet,
  )
  const sort = isWeb ? parseAcervoSort(params.sort) : undefined

  return {
    ...(isWeb ? { source: ACERVO_SOURCE_INTERNET } : {}),
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(mode ? { mode } : {}),
    ...(years.length ? { years } : {}),
    ...(topics.length ? { topics } : {}),
    ...(scopes.length ? { scopes } : {}),
    ...(phases.length ? { phases } : {}),
    ...(municipalities.length ? { municipalities } : {}),
    ...(durations.length ? { durations } : {}),
    ...(sort ? { sort } : {}),
  }
}

const speechListStateToRawParams = (
  state: SpeechListState,
  page = state.page,
): RawSpeechListParams => ({
  source: state.source,
  page: String(page),
  q: state.q,
  mode: state.mode,
  year: state.years?.map(String),
  topic: state.topics,
  scope: state.scopes,
  phase: state.phases,
  municipality: state.municipalities?.map(String),
  duration: state.durations,
  sort: state.sort,
})

/** Expects already-canonical state (from parse or a rule-preserving toggle). */
export const serializeCanonicalSpeechListSearchParams = (
  canonicalState: SpeechListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  // C216 — `source=internet` always serialized: it is what selects the web
  // source. The Câmara URL keeps its exact bytes (no source, no sort).
  if (canonicalState.source === 'internet') params.set('source', 'internet')
  if (canonicalState.q) params.set('q', canonicalState.q)
  // `termo` is the default and never serialized; `tema` only makes sense with a
  // query, so a theme param without `q` canonicalizes away.
  if (canonicalState.mode === 'tema' && canonicalState.q) params.set('mode', 'tema')
  for (const year of canonicalState.years ?? []) params.append('year', String(year))
  for (const topic of canonicalState.topics ?? []) params.append('topic', topic)
  for (const scope of canonicalState.scopes ?? []) params.append('scope', scope)
  for (const phase of canonicalState.phases ?? []) params.append('phase', phase)
  for (const municipality of canonicalState.municipalities ?? []) {
    params.append('municipality', String(municipality))
  }
  for (const duration of canonicalState.durations ?? []) params.append('duration', duration)
  // C216 — `recentes` is the default and never serialized; the sort belongs to
  // the web source only.
  if (canonicalState.source === 'internet' && canonicalState.sort) {
    params.set('sort', canonicalState.sort)
  }
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))
  return params
}

const buildSpeechListSearchParams = (state: SpeechListState, page = state.page): URLSearchParams =>
  serializeCanonicalSpeechListSearchParams(
    parseSpeechListParams(speechListStateToRawParams(state, page)),
  )

export const buildSpeechListHref = (state: SpeechListState, page: number): string =>
  buildListHref(state, buildSpeechListSearchParams, CAMPAIGN_COMMUNICATION_ACERVO, page)

export const buildSpeechFiltersKey = (state: SpeechListState): string =>
  buildSpeechListSearchParams(state).toString()

/**
 * C216 — Payload sort order of the web list: the default is the publication
 * order (`-speechAt`) and a duration order only lists rows with a measured
 * duration (the `where` gates `durationSeconds exists`; Postgres sorts NULLS
 * FIRST on DESC).
 */
export const webSpeechSortOrder = (state: SpeechListState): string => {
  switch (state.sort) {
    case 'duracao_maior':
      return '-durationSeconds'
    case 'duracao_menor':
      return 'durationSeconds'
    default:
      return '-speechAt'
  }
}

/**
 * C216 — whether the actor narrowed the list (query/mode or any facet). The
 * empty state uses it to tell "nothing was ever catalogued" from "the filters
 * hid everything"; `source` and pagination are not filters.
 */
export const speechHasActiveFilters = (state: SpeechListState): boolean =>
  Boolean(
    state.q ||
    state.mode ||
    state.years?.length ||
    state.topics?.length ||
    state.scopes?.length ||
    state.phases?.length ||
    state.municipalities?.length ||
    state.durations?.length,
  )

export const resolveSpeechListUrl = (
  params: RawSpeechListParams,
  totalPages?: number,
): {
  state: SpeechListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: speechListParamNameSet,
    parse: parseSpeechListParams,
    buildSearchParams: buildSpeechListSearchParams,
    basePath: CAMPAIGN_COMMUNICATION_ACERVO,
    totalPages,
  })
