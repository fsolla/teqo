'use client'

import { useMemo, useOptimistic, useState } from 'react'

import {
  CampaignHeaderFilterPopover,
  type CampaignHeaderFilterRow,
} from '@/components/campaign/shared/CampaignHeaderFilterPopover'
import {
  CampaignListOmnibox,
  campaignListOmniboxFormClassName,
} from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { SPEECH_SCOPES, SPEECH_TOPICS } from '@/lib/speechFacets'
import {
  buildSpeechListHref,
  SPEECH_DURATION_BUCKETS,
  speechDurationLabels,
  speechScopeLabels,
  speechTopicLabels,
  type SpeechFilterOptions,
  type SpeechListState,
} from '@/utilities/speech/speechListUrl'
import {
  applySpeechOmniboxSuggestion,
  buildSpeechOmniboxChips,
  buildSpeechOmniboxSuggestionSeeds,
  clearSpeechOmnibox,
  filterSpeechOmniboxSuggestions,
  removeSpeechOmniboxChip,
  type SpeechOmniboxAction,
} from '@/utilities/speech/speechOmnibox'

const topicOptions = SPEECH_TOPICS.map(({ value, label }) => ({ value, label }))
const scopeOptions = SPEECH_SCOPES.map(({ value, label }) => ({ value, label }))
const durationOptions = SPEECH_DURATION_BUCKETS.map(({ value, label }) => ({ value, label }))

type FacetKey = 'years' | 'topics' | 'scopes' | 'phases' | 'municipalities' | 'durations'

type SpeechFacet = {
  id: string
  label: string
  /** Prefix of the omnibox suggestion id (`${prefix}:${value}`). */
  prefix: string
  stateKey: FacetKey
  options: readonly { value: string; label: string }[]
  selected: readonly string[]
  labels?: Readonly<Record<string, string>>
}

const selectedTriggerLabel = (
  base: string,
  values: readonly string[],
  labels?: Readonly<Record<string, string>>,
): string => {
  if (values.length === 0) return base
  if (values.length === 1) return `${base}: ${labels?.[values[0]!] ?? values[0]}`
  return `${base}: ${values.length}`
}

export const SpeechAcervoFilters = ({
  state,
  filterOptions,
}: {
  state: SpeechListState
  filterOptions: SpeechFilterOptions
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildSpeechListHref(next, 1),
  })
  const [query, setQuery] = useState('')
  const [viewState, setOptimisticState] = useOptimistic(state)

  const municipalityLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of filterOptions.municipalities) {
      const id = Number(option.value)
      if (Number.isSafeInteger(id) && id > 0) map.set(id, option.label)
    }
    return map
  }, [filterOptions.municipalities])

  const chips = useMemo(
    () => buildSpeechOmniboxChips({ state: viewState, municipalityLabelsById }),
    [viewState, municipalityLabelsById],
  )

  const suggestionSeeds = useMemo(
    () =>
      buildSpeechOmniboxSuggestionSeeds({
        years: filterOptions.years,
        phases: filterOptions.phases,
        municipalityOptions: filterOptions.municipalities,
      }),
    [filterOptions],
  )

  const suggestions = useMemo(
    () => filterSpeechOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: SpeechOmniboxAction) => {
    if (action.kind === 'clear') {
      setQuery('')
      navigate(action.state)
      return
    }
    navigate(action.state)
  }

  const facetRows = (
    prefix: string,
    options: readonly { value: string; label: string }[],
    selected: readonly string[],
  ): CampaignHeaderFilterRow[] =>
    options.map((option) => {
      const next = applySpeechOmniboxSuggestion({
        state: viewState,
        suggestionId: `${prefix}:${option.value}`,
      }).state
      return {
        value: option.value,
        label: option.label,
        href: buildSpeechListHref(next, 1),
        selected: selected.includes(option.value),
        checkbox: true,
        onChoose: () => setOptimisticState(next),
      }
    })

  const clearFacet = (facet: FacetKey) => {
    const next: SpeechListState = { ...viewState, page: 1, [facet]: undefined }
    return { href: buildSpeechListHref(next, 1), onChoose: () => setOptimisticState(next) }
  }

  const years = (viewState.years ?? []).map(String)
  const topics = viewState.topics ?? []
  const scopes = viewState.scopes ?? []
  const phases = viewState.phases ?? []
  const municipalities = (viewState.municipalities ?? []).map(String)
  const durations = viewState.durations ?? []

  const facets: SpeechFacet[] = [
    {
      id: 'speech-filter-year',
      label: 'Ano',
      prefix: 'year',
      stateKey: 'years',
      options: filterOptions.years.map((year) => ({ value: String(year), label: String(year) })),
      selected: years,
    },
    {
      id: 'speech-filter-topic',
      label: 'Tema',
      prefix: 'topic',
      stateKey: 'topics',
      options: topicOptions,
      selected: topics,
      labels: speechTopicLabels,
    },
    {
      id: 'speech-filter-scope',
      label: 'Alcance',
      prefix: 'scope',
      stateKey: 'scopes',
      options: scopeOptions,
      selected: scopes,
      labels: speechScopeLabels,
    },
    {
      id: 'speech-filter-phase',
      label: 'Fase',
      prefix: 'phase',
      stateKey: 'phases',
      options: filterOptions.phases.map((phase) => ({ value: phase, label: phase })),
      selected: phases,
    },
    {
      id: 'speech-filter-municipality',
      label: 'Município',
      prefix: 'municipality',
      stateKey: 'municipalities',
      options: filterOptions.municipalities,
      selected: municipalities,
      labels: Object.fromEntries(municipalityLabelsById),
    },
    {
      id: 'speech-filter-duration',
      label: 'Duração',
      prefix: 'duration',
      stateKey: 'durations',
      options: durationOptions,
      selected: durations,
      labels: speechDurationLabels,
    },
  ]

  return (
    <form
      role="search"
      className={campaignListOmniboxFormClassName}
      onSubmit={(event) => {
        event.preventDefault()
      }}
    >
      <CampaignListOmnibox
        id="speech-omnibox"
        label="Buscar no acervo de falas"
        placeholder="Busque por assunto, tema, município ou palavra-chave…"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applySpeechOmniboxSuggestion({ state: viewState, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(applySpeechOmniboxSuggestion({ state: viewState, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeSpeechOmniboxChip({ state: viewState, chipId }))
        }}
        onClearAll={() => {
          runAction(clearSpeechOmnibox(viewState))
        }}
      />

      <div
        role="group"
        aria-label="Filtros do acervo"
        className="mt-2 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible"
      >
        {facets.map((facet) => (
          <CampaignHeaderFilterPopover
            key={facet.id}
            id={facet.id}
            label={facet.label}
            triggerVariant="chip"
            triggerLabel={selectedTriggerLabel(facet.label, facet.selected, facet.labels)}
            active={facet.selected.length > 0}
            closeOnChoose={false}
            optionRows={facetRows(facet.prefix, facet.options, facet.selected)}
            clear={facet.selected.length ? clearFacet(facet.stateKey) : undefined}
          />
        ))}
      </div>
    </form>
  )
}
