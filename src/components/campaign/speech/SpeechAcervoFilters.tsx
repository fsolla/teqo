'use client'

import { SparklesIcon, TriangleAlertIcon } from 'lucide-react'
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
import { cn } from '@/lib/utils'
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

const selectedTriggerLabel = (
  base: string,
  values: readonly string[],
  labels?: Readonly<Record<string, string>>,
): string => {
  if (values.length === 0) return base
  if (values.length === 1) return `${base}: ${labels?.[values[0]!] ?? values[0]}`
  return `${base}: ${values.length}`
}

/** C192 — segmented search-mode button (mobile full width, desktop inline). */
const modeButtonClass = (active: boolean, tone: 'termo' | 'tema'): string =>
  cn(
    'min-h-11 rounded-md px-3 text-sm md:min-h-9',
    active
      ? cn(
          'bg-white font-semibold shadow-sm ring-1 ring-border',
          tone === 'tema' ? 'text-primary' : 'text-foreground',
        )
      : 'font-medium text-muted-foreground',
  )

export const SpeechAcervoFilters = ({
  state,
  filterOptions,
  themeUnavailable = false,
}: {
  state: SpeechListState
  filterOptions: SpeechFilterOptions
  /** C192 — the theme expansion is down; the selector reflects the fallback. */
  themeUnavailable?: boolean
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
        id={SPEECH_OMNIBOX_ID}
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

      <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="flex w-full items-center gap-2 md:w-auto">
          <span className="hidden text-xs font-medium text-muted-foreground md:inline">
            Buscar por
          </span>
          <div
            role="group"
            aria-label="Modo de busca"
            className="grid w-full grid-cols-2 rounded-lg bg-muted p-1 md:inline-flex md:w-auto"
          >
            <button
              type="button"
              aria-pressed={activeMode === 'termo'}
              className={modeButtonClass(activeMode === 'termo', 'termo')}
              onClick={() => runMode('termo')}
            >
              Termo exato
            </button>
            <button
              type="button"
              aria-pressed={activeMode === 'tema'}
              aria-disabled={themeUnavailable || undefined}
              className={modeButtonClass(activeMode === 'tema', 'tema')}
              onClick={() => {
                if (themeUnavailable) return
                runMode('tema')
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                {themeUnavailable ? (
                  <TriangleAlertIcon
                    className="size-3.5 text-estimate-pending-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <SparklesIcon className="size-3.5" aria-hidden="true" />
                )}
                Por tema
              </span>
            </button>
          </div>
        </div>
        <p className="hidden text-xs text-muted-foreground md:block">
          {themeUnavailable
            ? 'Indisponível agora; mostramos o termo exato.'
            : 'Encontra falas relacionadas pelo sentido.'}
        </p>
      </div>

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
