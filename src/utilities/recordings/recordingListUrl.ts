/**
 * C199 — source switcher + list URL contract of the uploaded recordings. The
 * Câmara acervo keeps its own frozen contract (`speechListUrl`); the recordings
 * branch lives on the same `/campanha/comunicacao/acervo` page behind
 * `?source=enviadas` and owns its parses/serialization over the shared helpers.
 */
import { CAMPAIGN_COMMUNICATION_ACERVO } from '@/lib/campaignPaths'
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'
import { RECORDING_SPEAKER_LABEL_MAX_LENGTH } from '@/lib/recording'
import { foldSpeakerName } from '@/lib/recordingDiarization'
import {
  allParamValues,
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const recordingPageSize = 25

/** Which acervo source the page is showing. `camara` is the default. */
export type AcervoSource = 'camara' | 'enviadas'

const ACERVO_SOURCE_PARAM = 'source'
const ACERVO_SOURCE_ENVIADAS = 'enviadas'
const ACERVO_PERSON_PARAM = 'person'

const recordingListParamNames = [ACERVO_SOURCE_PARAM, 'q', 'page', ACERVO_PERSON_PARAM] as const
const recordingListParamNameSet = new Set<string>(recordingListParamNames)

export type RecordingListState = {
  source: 'enviadas'
  page: number
  q?: string
  /** Selected "Pessoa" labels; repeated `person` params, literal text. */
  people?: string[]
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

export const parseRecordingListParams = (params: RawSearchParams): RecordingListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const rawQ = normalizedText(firstValue(params.q))
  const q = rawQ && isContactSearchQueryReady(rawQ) ? rawQ : undefined
  const people = parseRecordingPeople(params[ACERVO_PERSON_PARAM])

  return {
    source: 'enviadas',
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(people.length > 0 ? { people } : {}),
  }
}

const recordingListSearchParams = (
  state: RecordingListState,
  page = state.page,
): URLSearchParams => {
  const params = new URLSearchParams()
  // `source=enviadas` is always serialized — it is what selects the source.
  params.set(ACERVO_SOURCE_PARAM, ACERVO_SOURCE_ENVIADAS)
  if (state.q) params.set('q', state.q)
  for (const person of state.people ?? []) params.append(ACERVO_PERSON_PARAM, person)
  if (page > 1) params.set('page', String(page))
  return params
}

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
