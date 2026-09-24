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
import { CampaignSearchModeControl } from '@/components/campaign/shared/CampaignSearchModeControl'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { selectedFilterTriggerLabel } from '@/lib/campaignListOmnibox'
import { SPEECH_SCOPES, SPEECH_TOPICS } from '@/lib/speechFacets'
import {
  buildSpeechListHref,
  SPEECH_DURATION_BUCKETS,
  speechDurationLabels,
  speechScopeLabels,
  speechTopicLabels,
  type SpeechFilterOptions,
  type SpeechListState,
  type SpeechSearchMode,
} from '@/utilities/speech/speechListUrl'
import {
  applySpeechOmniboxSuggestion,
  applySpeechSearchMode,
  buildSpeechOmniboxChips,
  buildSpeechOmniboxSuggestionSeeds,
  clearSpeechOmnibox,
  filterSpeechOmniboxSuggestions,
  removeSpeechOmniboxChip,
  SPEECH_OMNIBOX_ID,
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

export const SpeechAcervoFilters = ({
  state,
  filterOptions,
  themeUnavailable = false,
  omniboxLabel = 'Buscar no acervo de falas',
  omniboxPlaceholder = 'Busque por assunto, tema, município ou palavra-chave…',
  municipalityFacetLabel = 'Município',
  showPhaseFacet = true,
  filtersAriaLabel = 'Filtros do acervo',
}: {
  state: SpeechListState
  filterOptions: SpeechFilterOptions
  /** C192 — the theme expansion is down; the selector reflects the fallback. */
  themeUnavailable?: boolean
  /** C216 — the source's copy; the defaults are the Câmara's exact strings. */
  omniboxLabel?: string
  omniboxPlaceholder?: string
  /** C216 — the web source labels the facet "Município citado". */
  municipalityFacetLabel?: string
  /** C216 — the web source has no Fase facet. */
  showPhaseFacet?: boolean
  filtersAriaLabel?: string
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildSpeechListHref(next, 1),
  })
  const [query, setQuery] = useState('')
  const [viewState, setOptimisticState] = useOptimistic(state)

  const activeMode: SpeechSearchMode =
    viewState.mode === 'tema' && !themeUnavailable ? 'tema' : 'termo'

  const municipalityLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of filterOptions.municipalities) {
      const id = Number(option.value)
      if (Number.isSafeInteger(id) && id > 0) map.set(id, option.label)
    }
    return map
  }, [filterOptions.municipalities])

  const chips = useMemo(
    () =>
      buildSpeechOmniboxChips({
        state: viewState,
        municipalityLabelsById,
        municipalityLabel: municipalityFacetLabel,
      }),
    [viewState, municipalityLabelsById, municipalityFacetLabel],
  )

  const suggestionSeeds = useMemo(
    () =>
      buildSpeechOmniboxSuggestionSeeds({
        years: filterOptions.years,
        phases: filterOptions.phases,
        municipalityOptions: filterOptions.municipalities,
        municipalityLabel: municipalityFacetLabel,
      }),
    [filterOptions, municipalityFacetLabel],
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

  const runMode = (mode: SpeechSearchMode) => {
    const next = applySpeechSearchMode({ state: viewState, mode }).state
    setOptimisticState(next)
    navigate(next)
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

  const municipalityFacet: SpeechFacet = {
    id: 'speech-filter-municipality',
    label: municipalityFacetLabel,
    prefix: 'municipality',
    stateKey: 'municipalities',
    options: filterOptions.municipalities,
    selected: municipalities,
    labels: Object.fromEntries(municipalityLabelsById),
  }
  const durationFacet: SpeechFacet = {
    id: 'speech-filter-duration',
    label: 'Duração',
    prefix: 'duration',
    stateKey: 'durations',
    options: durationOptions,
    selected: durations,
    labels: speechDurationLabels,
  }

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
    ...(showPhaseFacet
      ? [
          {
            id: 'speech-filter-phase',
            label: 'Fase',
            prefix: 'phase',
            stateKey: 'phases' as const,
            options: filterOptions.phases.map((phase) => ({ value: phase, label: phase })),
            selected: phases,
          },
        ]
      : []),
    // C216 — the approved web order is Ano · Tema · Alcance · Duração ·
    // Município citado; the Câmara keeps its own (Município before Duração).
    ...(state.source === 'internet'
      ? [durationFacet, municipalityFacet]
      : [municipalityFacet, durationFacet]),
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
        id={SPEECH_OMNIBOX_ID}
        label={omniboxLabel}
        placeholder={omniboxPlaceholder}
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

      <CampaignSearchModeControl
        activeMode={activeMode}
        themeUnavailable={themeUnavailable}
        onSelect={runMode}
        relatedHint="Encontra falas relacionadas pelo sentido."
      />

      <div
        role="group"
        aria-label={filtersAriaLabel}
        className="mt-2 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible"
      >
        {facets.map((facet) => (
          <CampaignHeaderFilterPopover
            key={facet.id}
            id={facet.id}
            label={facet.label}
            triggerVariant="chip"
            triggerLabel={selectedFilterTriggerLabel(facet.label, facet.selected, facet.labels)}
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
