/**
 * Speech acervo omnibox adapter (C154). Pure / client-safe: builds the active
 * chips, the suggestion seeds (facet constants plus server-loaded years/phases/
 * municipalities) and the toggle/remove/clear actions over the URL state.
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
  SPEECH_DURATION_BUCKETS,
  speechDurationLabels,
  speechScopeLabels,
  speechTopicLabels,
  type SpeechDurationBucket,
  type SpeechListState,
  type SpeechSearchMode,
} from '@/utilities/speech/speechListUrl'

export type SpeechFilterOption = {
  value: string
  label: string
}

/**
 * C192 — the omnibox input's DOM id, shared by the filters bar and the empty
 * state's "Reformular busca" focus action.
 */
export const SPEECH_OMNIBOX_ID = 'speech-omnibox'

export type SpeechOmniboxAction =
  | { kind: 'url'; state: SpeechListState }
  | { kind: 'clear'; state: SpeechListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const withPageReset = (state: SpeechListState): SpeechListState => ({ ...state, page: 1 })

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
  state: SpeechListState,
  key: string,
  value: string,
  mode: FacetMutation,
): SpeechListState | null => {
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
    case 'phase':
      return { ...state, phases: mutate(state.phases, value) }
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

export const buildSpeechOmniboxChips = ({
  state,
  municipalityLabelsById,
  municipalityLabel = 'Município',
}: {
  state: SpeechListState
  municipalityLabelsById: ReadonlyMap<number, string>
  /** C216 — the web source labels the facet "Município citado". */
  municipalityLabel?: string
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
  for (const phase of state.phases ?? []) {
    chips.push({ id: `phase:${phase}`, label: chipLabel('Fase', phase) })
  }
  for (const municipality of state.municipalities ?? []) {
    chips.push({
      id: `municipality:${municipality}`,
      label: chipLabel(
        municipalityLabel,
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

  return chips
}

export const buildSpeechOmniboxSuggestionSeeds = ({
  years,
  phases,
  municipalityOptions,
  municipalityLabel = 'Município',
}: {
  years: readonly number[]
  phases: readonly string[]
  municipalityOptions: readonly SpeechFilterOption[]
  /** C216 — the web source labels the facet "Município citado". */
  municipalityLabel?: string
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

  for (const phase of phases) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `phase:${phase}`,
        group: 'Fase',
        label: phase,
        keywords: ['fase', 'sessao'],
      }),
    )
  }

  for (const option of municipalityOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `municipality:${option.value}`,
        group: municipalityLabel,
        label: option.label,
        keywords: ['municipio', 'cidade'],
      }),
    )
  }

  return seeds
}

export const filterSpeechOmniboxSuggestions = (
  seeds: ReturnType<typeof buildSpeechOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applySpeechOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: SpeechListState
  suggestionId: string
}): SpeechOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2).trim()
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }

  const { key, value } = chipPrefix(suggestionId)
  const next = mutateFacet(withPageReset(state), key, value, 'toggle')
  return { kind: 'url', state: next ?? state }
}

export const removeSpeechOmniboxChip = ({
  state,
  chipId,
}: {
  state: SpeechListState
  chipId: string
}): SpeechOmniboxAction => {
  // Dropping the query also drops the theme mode: a theme without a query has
  // nothing to expand.
  if (chipId === 'q') {
    return { kind: 'url', state: withPageReset({ ...state, q: undefined, mode: undefined }) }
  }

  const { key, value } = chipPrefix(chipId)
  const next = mutateFacet(withPageReset(state), key, value, 'remove')
  return { kind: 'url', state: next ?? state }
}

/**
 * C192 — the search mode toggle. `tema` only sticks with a query; `termo`
 * (the default) clears the param so the URL stays canonical and shareable.
 */
export const applySpeechSearchMode = ({
  state,
  mode,
}: {
  state: SpeechListState
  mode: SpeechSearchMode
}): SpeechOmniboxAction => ({
  kind: 'url',
  state: withPageReset({ ...state, mode: mode === 'tema' && state.q ? 'tema' : undefined }),
})

/**
 * C216 — clearing keeps `source: 'internet'`: the source is what selects the
 * web list, so dropping it would send "clear" back to the Câmara.
 */
export const clearSpeechOmnibox = (state: SpeechListState): SpeechOmniboxAction => ({
  kind: 'clear',
  state: {
    page: 1,
    ...(state.source === 'internet' ? { source: 'internet' } : {}),
  },
})
