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
  buildRecordingListHref,
  toggleRecordingPerson,
  type RecordingFilterOptions,
  type RecordingListState,
} from '@/utilities/recordings/recordingListUrl'
import {
  applyRecordingOmniboxSuggestion,
  applyRecordingSearchMode,
  buildRecordingOmniboxChips,
  buildRecordingOmniboxSuggestionSeeds,
  clearRecordingOmnibox,
  filterRecordingOmniboxSuggestions,
  removeRecordingOmniboxChip,
  type RecordingOmniboxAction,
} from '@/utilities/recordings/recordingOmnibox'
import {
  SPEECH_DURATION_BUCKETS,
  speechDurationLabels,
  speechScopeLabels,
  speechTopicLabels,
  type SpeechSearchMode,
} from '@/utilities/speech/speechListUrl'

const topicOptions = SPEECH_TOPICS.map(({ value, label }) => ({ value, label }))
const scopeOptions = SPEECH_SCOPES.map(({ value, label }) => ({ value, label }))
const durationOptions = SPEECH_DURATION_BUCKETS.map(({ value, label }) => ({ value, label }))

type FacetKey = 'years' | 'topics' | 'scopes' | 'municipalities' | 'durations' | 'people'

type RecordingFacet = {
  id: string
  label: string
  /** Prefix of the omnibox suggestion id (`${prefix}:${value}`). */
  prefix: string
  stateKey: FacetKey
  options: readonly { value: string; label: string }[]
  selected: readonly string[]
  labels?: Readonly<Record<string, string>>
}

/**
 * C219 — the filter bar of "Gravações enviadas": same gestures as the Câmara
 * acervo (search by term or theme, year, topic, scope, cited municipality,
 * duration) plus the exclusive "Pessoa" facet. The mechanics (omnibox, chips,
 * facet popovers, pending boundary) are the shared shells; this component only
 * assembles the recordings facets. Ported from the approved hi-fi design
 * (`docs/plans/acervo-paridade-busca-filtros-ui-design.html`, scenes 01/02).
 */
export const RecordingAcervoFilters = ({
  state,
  filterOptions,
  themeUnavailable = false,
}: {
  state: RecordingListState
  filterOptions: RecordingFilterOptions
  /** C219 — the theme expansion is down; the selector reflects the fallback. */
  themeUnavailable?: boolean
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildRecordingListHref(next, 1),
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
    () => buildRecordingOmniboxChips({ state: viewState, municipalityLabelsById }),
    [viewState, municipalityLabelsById],
  )

  const suggestionSeeds = useMemo(
    () =>
      buildRecordingOmniboxSuggestionSeeds({
        years: filterOptions.years,
        municipalityOptions: filterOptions.municipalities,
        personOptions: filterOptions.people,
      }),
    [filterOptions],
  )

  const suggestions = useMemo(
    () => filterRecordingOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: RecordingOmniboxAction) => {
    if (action.kind === 'clear') {
      setQuery('')
      navigate(action.state)
      return
    }
    navigate(action.state)
  }

  const runMode = (mode: SpeechSearchMode) => {
    const next = applyRecordingSearchMode({ state: viewState, mode }).state
    setOptimisticState(next)
    navigate(next)
  }

  const facetRows = (
    prefix: string,
    options: readonly { value: string; label: string }[],
    selected: readonly string[],
  ): CampaignHeaderFilterRow[] =>
    options.map((option) => {
      const next = applyRecordingOmniboxSuggestion({
        state: viewState,
        suggestionId: `${prefix}:${option.value}`,
      }).state
      return {
        value: option.value,
        label: option.label,
        href: buildRecordingListHref(next, 1),
        selected: selected.includes(option.value),
        checkbox: true,
        onChoose: () => setOptimisticState(next),
      }
    })

  const personRows = (): CampaignHeaderFilterRow[] =>
    filterOptions.people.map((person) => {
      const next = toggleRecordingPerson(viewState, person)
      return {
        value: person,
        label: person,
        href: buildRecordingListHref(next, 1),
        selected: (viewState.people ?? []).some(
          (selected) => selected.toLocaleLowerCase('pt-BR') === person.toLocaleLowerCase('pt-BR'),
        ),
        checkbox: true,
        onChoose: () => setOptimisticState(next),
      }
    })

  const clearFacet = (facet: FacetKey) => {
    const next: RecordingListState = { ...viewState, page: 1, [facet]: undefined }
    return { href: buildRecordingListHref(next, 1), onChoose: () => setOptimisticState(next) }
  }

  const years = (viewState.years ?? []).map(String)
  const topics = viewState.topics ?? []
  const scopes = viewState.scopes ?? []
  const municipalities = (viewState.municipalities ?? []).map(String)
  const durations = viewState.durations ?? []
  const people = viewState.people ?? []

  const facets: RecordingFacet[] = [
    {
      id: 'recording-filter-year',
      label: 'Ano',
      prefix: 'year',
      stateKey: 'years',
      options: filterOptions.years.map((year) => ({ value: String(year), label: String(year) })),
      selected: years,
    },
    {
      id: 'recording-filter-topic',
      label: 'Tema',
      prefix: 'topic',
      stateKey: 'topics',
      options: topicOptions,
      selected: topics,
      labels: speechTopicLabels,
    },
    {
      id: 'recording-filter-scope',
      label: 'Alcance',
      prefix: 'scope',
      stateKey: 'scopes',
      options: scopeOptions,
      selected: scopes,
      labels: speechScopeLabels,
    },
    {
      id: 'recording-filter-municipality',
      label: 'Município citado',
      prefix: 'municipality',
      stateKey: 'municipalities',
      options: filterOptions.municipalities,
      selected: municipalities,
      labels: Object.fromEntries(municipalityLabelsById),
    },
    {
      id: 'recording-filter-duration',
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
        id="recording-omnibox"
        label="Buscar nas gravações enviadas"
        placeholder="Busque por palavra, trecho ou tema da transcrição…"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyRecordingOmniboxSuggestion({ state: viewState, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(
            applyRecordingOmniboxSuggestion({ state: viewState, suggestionId: `q:${text}` }),
          )
        }}
        onRemoveChip={(chipId) => {
          runAction(removeRecordingOmniboxChip({ state: viewState, chipId }))
        }}
        onClearAll={() => {
          runAction(clearRecordingOmnibox(viewState))
        }}
      />

      <CampaignSearchModeControl
        activeMode={activeMode}
        themeUnavailable={themeUnavailable}
        onSelect={runMode}
        relatedHint="Encontra gravações relacionadas pelo sentido."
      />

      <div
        role="group"
        aria-label="Filtros do acervo de gravações"
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
        <CampaignHeaderFilterPopover
          id="recording-filter-person"
          label="Pessoa"
          triggerVariant="chip"
          triggerLabel={selectedFilterTriggerLabel('Pessoa', people)}
          active={people.length > 0}
          closeOnChoose={false}
          emptyLabel="Nenhuma pessoa identificada nas gravações."
          optionRows={personRows()}
          clear={people.length ? clearFacet('people') : undefined}
        />
      </div>
    </form>
  )
}
