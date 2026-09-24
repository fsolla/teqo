/**
 * Speech acervo URL contract (C154): state, param parse/canonicalize and
 * hrefs, same shape as `peopleListUrl`/`supporterUi` over the shared
 * `campaignListUrl` helpers. Facet enums are exhaustive (selecting every
 * member equals no filter); year/phase/municipality are data-driven and
 * validated structurally.
 */
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
  page: number
  q?: string
  mode?: SpeechSearchMode
  years?: number[]
  topics?: SpeechTopic[]
  scopes?: SpeechScope[]
  phases?: string[]
  municipalities?: number[]
  durations?: SpeechDurationBucket[]
}

/** Server-loaded filter options (years/phases present, cited municipalities). */
export type SpeechFilterOptions = {
  years: number[]
  phases: string[]
  municipalities: { value: string; label: string }[]
}

type RawSpeechListParams = RawSearchParams

const speechListParamNames = [
  'q',
  'mode',
  'year',
  'topic',
  'scope',
  'phase',
  'municipality',
  'duration',
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
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const rawQ = normalizedText(firstValue(params.q))
  const q = rawQ && isContactSearchQueryReady(rawQ) ? rawQ : undefined
  const mode = parseSpeechSearchMode(params.mode)
  const years = parseYearValues(params.year)
  const topics = parseExhaustiveEnumParam<SpeechTopic>(params.topic, speechTopicSet)
  const scopes = parseExhaustiveEnumParam<SpeechScope>(params.scope, speechScopeSet)
  const phases = allParamValues(params.phase).filter((token) => token.length <= MAX_PHASE_LENGTH)
  const municipalities = parseMunicipalityValues(params.municipality)
  const durations = parseExhaustiveEnumParam<SpeechDurationBucket>(
    params.duration,
    speechDurationSet,
  )

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(mode ? { mode } : {}),
    ...(years.length ? { years } : {}),
    ...(topics.length ? { topics } : {}),
    ...(scopes.length ? { scopes } : {}),
    ...(phases.length ? { phases } : {}),
    ...(municipalities.length ? { municipalities } : {}),
    ...(durations.length ? { durations } : {}),
  }
}

const speechListStateToRawParams = (
  state: SpeechListState,
  page = state.page,
): RawSpeechListParams => ({
  page: String(page),
  q: state.q,
  mode: state.mode,
  year: state.years?.map(String),
  topic: state.topics,
  scope: state.scopes,
  phase: state.phases,
  municipality: state.municipalities?.map(String),
  duration: state.durations,
})

/** Expects already-canonical state (from parse or a rule-preserving toggle). */
export const serializeCanonicalSpeechListSearchParams = (
  canonicalState: SpeechListState,
): URLSearchParams => {
  const params = new URLSearchParams()
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
