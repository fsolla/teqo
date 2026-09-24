/**
 * C199/C219 — source switcher + list URL contract of the uploaded recordings.
 * The Câmara acervo keeps its own frozen contract (`speechListUrl`); the
 * recordings branch lives on the same `/campanha/comunicacao/acervo` page
 * behind `?source=enviadas` and owns its parses/serialization over the shared
 * helpers. C219 brings the parity facets — search mode, year, topic, scope,
 * cited municipality, duration and sort — reusing the Câmara taxonomy, the
 * duration buckets and the structural year/municipality parsers. The original
 * `?source=enviadas&q&person&page` deep links stay byte-identical: the new
 * params are only serialized when selected and `mode=termo`/the default sort
 * are never serialized.
 */
import { CAMPAIGN_COMMUNICATION_ACERVO } from '@/lib/campaignPaths'
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'
import { RECORDING_SPEAKER_LABEL_MAX_LENGTH } from '@/lib/recording'
import { foldSpeakerName } from '@/lib/recordingDiarization'
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
import {
  SPEECH_DURATION_BUCKETS,
  type SpeechDurationBucket,
  type SpeechSearchMode,
} from '@/utilities/speech/speechListUrl'

export const recordingPageSize = 25

/** Which acervo source the page is showing. `camara` is the default. */
export type AcervoSource = 'camara' | 'enviadas'

/**
 * C219 — list ordering. `recentes` is the default and never serialized (the
 * stored contract stays `-createdAt`); the duration orders only list rows with
 * a measured duration, which is why the `where` gates `durationSeconds`.
 */
export const RECORDING_SORT_OPTIONS = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'duracao_maior', label: 'Duração (maior)' },
  { value: 'duracao_menor', label: 'Duração (menor)' },
] as const

export type RecordingSortKey = (typeof RECORDING_SORT_OPTIONS)[number]['value']

const ACERVO_SOURCE_PARAM = 'source'
const ACERVO_SOURCE_ENVIADAS = 'enviadas'
const ACERVO_PERSON_PARAM = 'person'

const recordingListParamNames = [
  ACERVO_SOURCE_PARAM,
  'q',
  'mode',
  'year',
  'topic',
  'scope',
  'municipality',
  'duration',
  'sort',
  ACERVO_PERSON_PARAM,
  'page',
] as const
const recordingListParamNameSet = new Set<string>(recordingListParamNames)
const recordingTopicSet = new Set<string>(SPEECH_TOPICS.map(({ value }) => value))
const recordingScopeSet = new Set<string>(SPEECH_SCOPES.map(({ value }) => value))
const recordingDurationSet = new Set<string>(SPEECH_DURATION_BUCKETS.map(({ value }) => value))
const recordingSortSet = new Set<string>(RECORDING_SORT_OPTIONS.map(({ value }) => value))

export type RecordingListState = {
  source: 'enviadas'
  page: number
  q?: string
  /** C219 — `tema` asks the semantic bridge; `termo` (default) is never stored. */
  mode?: SpeechSearchMode
  years?: number[]
  topics?: SpeechTopic[]
  scopes?: SpeechScope[]
  /** Cited municipalities (`mentionedMunicipalities`), not the uploader's. */
  municipalities?: number[]
  durations?: SpeechDurationBucket[]
  sort?: RecordingSortKey
  /** Selected "Pessoa" labels; repeated `person` params, literal text. */
  people?: string[]
}

/** Server-loaded filter options (present years, cited municipalities, people). */
export type RecordingFilterOptions = {
  people: string[]
  years: number[]
  municipalities: { value: string; label: string }[]
}

/** `enviadas` only for the explicit value; anything else is the Câmara default. */
export const parseAcervoSource = (params: RawSearchParams): AcervoSource =>
  firstValue(params[ACERVO_SOURCE_PARAM]) === ACERVO_SOURCE_ENVIADAS ? 'enviadas' : 'camara'

/**
 * Parses the repeated `person` filter: trims, drops empty and oversized values
 * (a label never exceeds the field limit, so an oversized token can only be a
 * hand-typed miss) and dedupes case-insensitively keeping the first spelling.
 */
export const parseRecordingPeople = (raw: string | string[] | undefined): string[] => {
  const people: string[] = []
  const seen = new Set<string>()
  for (const value of allParamValues(raw)) {
    if (value.length > RECORDING_SPEAKER_LABEL_MAX_LENGTH) continue
    const folded = foldSpeakerName(value)
    if (seen.has(folded)) continue
    seen.add(folded)
    people.push(value)
  }
  return people
}

/** Only `tema` is meaningful; anything else (and `termo`) means the default. */
const parseRecordingSearchMode = (
  raw: string | string[] | undefined,
): SpeechSearchMode | undefined => (firstValue(raw) === 'tema' ? 'tema' : undefined)

/** Only the non-default duration orders are meaningful; anything else is `recentes`. */
const parseRecordingSort = (raw: string | string[] | undefined): RecordingSortKey | undefined => {
  const value = firstValue(raw)
  return value && value !== 'recentes' && recordingSortSet.has(value)
    ? (value as RecordingSortKey)
    : undefined
}

export const parseRecordingListParams = (params: RawSearchParams): RecordingListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const rawQ = normalizedText(firstValue(params.q))
  const q = rawQ && isContactSearchQueryReady(rawQ) ? rawQ : undefined
  const mode = parseRecordingSearchMode(params.mode)
  const years = parseYearValues(params.year)
  const topics = parseExhaustiveEnumParam<SpeechTopic>(params.topic, recordingTopicSet)
  const scopes = parseExhaustiveEnumParam<SpeechScope>(params.scope, recordingScopeSet)
  const municipalities = parseMunicipalityValues(params.municipality)
  const durations = parseExhaustiveEnumParam<SpeechDurationBucket>(
    params.duration,
    recordingDurationSet,
  )
  const sort = parseRecordingSort(params.sort)
  const people = parseRecordingPeople(params[ACERVO_PERSON_PARAM])

  return {
    source: 'enviadas',
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(mode ? { mode } : {}),
    ...(years.length ? { years } : {}),
    ...(topics.length ? { topics } : {}),
    ...(scopes.length ? { scopes } : {}),
    ...(municipalities.length ? { municipalities } : {}),
    ...(durations.length ? { durations } : {}),
    ...(sort ? { sort } : {}),
    ...(people.length > 0 ? { people } : {}),
  }
}

const recordingListStateToRawParams = (
  state: RecordingListState,
  page = state.page,
): RawSearchParams => ({
  [ACERVO_SOURCE_PARAM]: ACERVO_SOURCE_ENVIADAS,
  page: String(page),
  q: state.q,
  mode: state.mode,
  year: state.years?.map(String),
  topic: state.topics,
  scope: state.scopes,
  municipality: state.municipalities?.map(String),
  duration: state.durations,
  sort: state.sort,
  [ACERVO_PERSON_PARAM]: state.people,
})

/** Expects already-canonical state (from parse or a rule-preserving toggle). */
const serializeCanonicalRecordingListSearchParams = (
  canonicalState: RecordingListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  // `source=enviadas` is always serialized — it is what selects the source.
  params.set(ACERVO_SOURCE_PARAM, ACERVO_SOURCE_ENVIADAS)
  if (canonicalState.q) params.set('q', canonicalState.q)
  // `termo` is the default and never serialized; `tema` only makes sense with a
  // query, so a theme param without `q` canonicalizes away.
  if (canonicalState.mode === 'tema' && canonicalState.q) params.set('mode', 'tema')
  for (const year of canonicalState.years ?? []) params.append('year', String(year))
  for (const topic of canonicalState.topics ?? []) params.append('topic', topic)
  for (const scope of canonicalState.scopes ?? []) params.append('scope', scope)
  for (const municipality of canonicalState.municipalities ?? []) {
    params.append('municipality', String(municipality))
  }
  for (const duration of canonicalState.durations ?? []) params.append('duration', duration)
  // `recentes` is the default and never serialized.
  if (canonicalState.sort && canonicalState.sort !== 'recentes') {
    params.set('sort', canonicalState.sort)
  }
  for (const person of canonicalState.people ?? []) params.append(ACERVO_PERSON_PARAM, person)
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))
  return params
}

const recordingListSearchParams = (state: RecordingListState, page = state.page): URLSearchParams =>
  serializeCanonicalRecordingListSearchParams(
    parseRecordingListParams(recordingListStateToRawParams(state, page)),
  )

/** The URL of one "Pessoa" facet option with `person` toggled (page resets). */
export const toggleRecordingPerson = (
  state: RecordingListState,
  value: string,
): RecordingListState => {
  const current = state.people ?? []
  const folded = foldSpeakerName(value)
  const selected = current.some((person) => foldSpeakerName(person) === folded)
  const people = selected
    ? current.filter((person) => foldSpeakerName(person) !== folded)
    : [...current, value]
  return { ...state, page: 1, ...(people.length > 0 ? { people } : { people: undefined }) }
}

/** The URL that removes one selected "Pessoa" (chips with an X; page resets). */
export const removeRecordingPerson = (
  state: RecordingListState,
  value: string,
): RecordingListState => {
  const folded = foldSpeakerName(value)
  const people = (state.people ?? []).filter((person) => foldSpeakerName(person) !== folded)
  return { ...state, page: 1, ...(people.length > 0 ? { people } : { people: undefined }) }
}

export const buildRecordingListHref = (state: RecordingListState, page: number): string =>
  buildListHref(state, recordingListSearchParams, CAMPAIGN_COMMUNICATION_ACERVO, page)

/**
 * C219 — the canonical query drives the filter bar remount (`key`), exactly
 * like `buildSpeechFiltersKey`, so optimistic state resets when the URL
 * changes.
 */
export const buildRecordingFiltersKey = (state: RecordingListState): string =>
  recordingListSearchParams(state).toString()

/** Payload sort order of the list: the default keeps the stored `-createdAt`. */
export const recordingSortOrder = (state: RecordingListState): string => {
  switch (state.sort) {
    case 'duracao_maior':
      return '-durationSeconds'
    case 'duracao_menor':
      return 'durationSeconds'
    default:
      return '-createdAt'
  }
}

/** Duration orders only make sense over rows with a measured duration. */
export const recordingSortIsDuration = (state: RecordingListState): boolean =>
  state.sort === 'duracao_maior' || state.sort === 'duracao_menor'

/**
 * C219 — whether the actor narrowed the list (query/mode or any facet). The
 * empty state uses it to tell "no recording was ever sent" from "the filters
 * hid everything"; pagination is not a filter.
 */
export const recordingHasActiveFilters = (state: RecordingListState): boolean =>
  Boolean(
    state.q ||
    state.mode ||
    state.years?.length ||
    state.topics?.length ||
    state.scopes?.length ||
    state.municipalities?.length ||
    state.durations?.length ||
    state.people?.length,
  )

/** Toggle hrefs of the source switcher (the Câmara side is the bare acervo). */
export const buildAcervoSourceHref = (source: AcervoSource): string =>
  source === 'enviadas'
    ? `${CAMPAIGN_COMMUNICATION_ACERVO}?${ACERVO_SOURCE_PARAM}=${ACERVO_SOURCE_ENVIADAS}`
    : CAMPAIGN_COMMUNICATION_ACERVO

export const resolveRecordingListUrl = (
  params: RawSearchParams,
  totalPages?: number,
): { state: RecordingListState; href: string; redirectHref?: string } =>
  resolveListUrl({
    params,
    paramNameSet: recordingListParamNameSet,
    parse: parseRecordingListParams,
    buildSearchParams: recordingListSearchParams,
    basePath: CAMPAIGN_COMMUNICATION_ACERVO,
    totalPages,
  })
