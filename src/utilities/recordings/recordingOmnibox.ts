/**
 * C219 — recordings acervo omnibox adapter. Pure / client-safe: builds the
 * active chips, the suggestion seeds (facet constants plus server-loaded
 * years/municipalities/people) and the toggle/remove/clear actions over the
 * URL state, mirroring `speechOmnibox` on the same shared helpers. "Pessoa"
 * reuses the case-insensitive dedupe owned by the recordings URL contract.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import {
  SPEECH_SCOPES,
  SPEECH_TOPICS,
  type SpeechScope,
  type SpeechTopic,
} from '@/lib/speechFacets'
import {
  removeRecordingPerson,
  toggleRecordingPerson,
  type RecordingListState,
} from '@/utilities/recordings/recordingListUrl'
import {
  SPEECH_DURATION_BUCKETS,
  speechDurationLabels,
  speechScopeLabels,
  speechTopicLabels,
  type SpeechDurationBucket,
  type SpeechSearchMode,
} from '@/utilities/speech/speechListUrl'

export type RecordingFilterOption = {
  value: string
  label: string
}

const MUNICIPALITY_CHIP_LABEL = 'Município citado'

export type RecordingOmniboxAction =
  | { kind: 'url'; state: RecordingListState }
  | { kind: 'clear'; state: RecordingListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const withPageReset = (state: RecordingListState): RecordingListState => ({ ...state, page: 1 })

const toggleValue = <T>(values: T[] | undefined, value: T): T[] | undefined => {
  const current = values ?? []
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
  return next.length ? next : undefined
}

const removeValue = <T>(values: T[] | undefined, value: T): T[] | undefined => {
  const next = (values ?? []).filter((item) => item !== value)
  return next.length ? next : undefined
}

const chipPrefix = (chipId: string): { key: string; value: string } => {
  const separator = chipId.indexOf(':')
  if (separator === -1) return { key: chipId, value: '' }
  return { key: chipId.slice(0, separator), value: chipId.slice(separator + 1) }
}

type FacetMutation = 'toggle' | 'remove'

/**
 * ONE facet mutation for both omnibox actions: `toggle` (selecting a
 * suggestion) and `remove` (dropping a chip) differ only in the values
 * operation. Returns null when the id carries an invalid numeric value.
 */
const mutateFacet = (
  state: RecordingListState,
  key: string,
  value: string,
  mode: FacetMutation,
): RecordingListState | null => {
  const mutate = mode === 'toggle' ? toggleValue : removeValue
  switch (key) {
    case 'year': {
      const year = Number(value)
      if (!Number.isSafeInteger(year)) return null
      return { ...state, years: mutate(state.years, year) }
    }
    case 'topic':
      return { ...state, topics: mutate(state.topics, value as SpeechTopic) }
    case 'scope':
      return { ...state, scopes: mutate(state.scopes, value as SpeechScope) }
    case 'municipality': {
      const municipality = Number(value)
      if (!Number.isSafeInteger(municipality)) return null
      return { ...state, municipalities: mutate(state.municipalities, municipality) }
    }
    case 'duration':
      return { ...state, durations: mutate(state.durations, value as SpeechDurationBucket) }
    default:
      return null
  }
}

export const buildRecordingOmniboxChips = ({
  state,
  municipalityLabelsById,
}: {
  state: RecordingListState
  municipalityLabelsById: ReadonlyMap<number, string>
}): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })
  for (const year of state.years ?? []) {
    chips.push({ id: `year:${year}`, label: chipLabel('Ano', String(year)) })
  }
  for (const topic of state.topics ?? []) {
    chips.push({ id: `topic:${topic}`, label: chipLabel('Tema', speechTopicLabels[topic]) })
  }
  for (const scope of state.scopes ?? []) {
    chips.push({ id: `scope:${scope}`, label: chipLabel('Alcance', speechScopeLabels[scope]) })
  }
  for (const municipality of state.municipalities ?? []) {
    chips.push({
      id: `municipality:${municipality}`,
      label: chipLabel(
        MUNICIPALITY_CHIP_LABEL,
        municipalityLabelsById.get(municipality) ?? `Município #${municipality}`,
      ),
    })
  }
  for (const duration of state.durations ?? []) {
    chips.push({
      id: `duration:${duration}`,
      label: chipLabel('Duração', speechDurationLabels[duration]),
    })
  }
  for (const person of state.people ?? []) {
    chips.push({ id: `person:${person}`, label: chipLabel('Pessoa', person) })
  }

  return chips
}

export const buildRecordingOmniboxSuggestionSeeds = ({
  years,
  municipalityOptions,
  personOptions,
}: {
  years: readonly number[]
  municipalityOptions: readonly RecordingFilterOption[]
  personOptions: readonly string[]
}) => {
  const seeds = []

  for (const { value, label } of SPEECH_TOPICS) {
    seeds.push(
      createOmniboxSuggestionSeed(
        { id: `topic:${value}`, group: 'Tema', label, keywords: ['tema'] },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const { value, label } of SPEECH_SCOPES) {
    seeds.push(
      createOmniboxSuggestionSeed(
        { id: `scope:${value}`, group: 'Alcance', label, keywords: ['alcance'] },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const { value, label } of SPEECH_DURATION_BUCKETS) {
    seeds.push(
      createOmniboxSuggestionSeed(
        { id: `duration:${value}`, group: 'Duração', label, keywords: ['duracao', 'tempo'] },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const year of years) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `year:${year}`,
        group: 'Ano',
        label: String(year),
        keywords: ['ano'],
      }),
    )
  }

  for (const option of municipalityOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `municipality:${option.value}`,
        group: MUNICIPALITY_CHIP_LABEL,
        label: option.label,
        keywords: ['municipio', 'cidade', 'citado'],
      }),
    )
  }

  for (const person of personOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `person:${person}`,
        group: 'Pessoa',
        label: person,
        keywords: ['pessoa', 'falante'],
      }),
    )
  }

  return seeds
}

export const filterRecordingOmniboxSuggestions = (
  seeds: ReturnType<typeof buildRecordingOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyRecordingOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: RecordingListState
  suggestionId: string
}): RecordingOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2).trim()
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }

  const { key, value } = chipPrefix(suggestionId)
  if (key === 'person') {
    return { kind: 'url', state: toggleRecordingPerson(withPageReset(state), value) }
  }

  const next = mutateFacet(withPageReset(state), key, value, 'toggle')
  return { kind: 'url', state: next ?? state }
}

export const removeRecordingOmniboxChip = ({
  state,
  chipId,
}: {
  state: RecordingListState
  chipId: string
}): RecordingOmniboxAction => {
  // Dropping the query also drops the theme mode: a theme without a query has
  // nothing to expand.
  if (chipId === 'q') {
    return { kind: 'url', state: withPageReset({ ...state, q: undefined, mode: undefined }) }
  }

  const { key, value } = chipPrefix(chipId)
  if (key === 'person') {
    return { kind: 'url', state: removeRecordingPerson(withPageReset(state), value) }
  }

  const next = mutateFacet(withPageReset(state), key, value, 'remove')
  return { kind: 'url', state: next ?? state }
}

/**
 * C219 — the search mode toggle. `tema` only sticks with a query; `termo`
 * (the default) clears the param so the URL stays canonical and shareable.
 */
export const applyRecordingSearchMode = ({
  state,
  mode,
}: {
  state: RecordingListState
  mode: SpeechSearchMode
}): RecordingOmniboxAction => ({
  kind: 'url',
  state: withPageReset({ ...state, mode: mode === 'tema' && state.q ? 'tema' : undefined }),
})

/** Clearing keeps `source=enviadas` — it is what selects this source. */
export const clearRecordingOmnibox = (_state: RecordingListState): RecordingOmniboxAction => ({
  kind: 'clear',
  state: { source: 'enviadas', page: 1 },
})
