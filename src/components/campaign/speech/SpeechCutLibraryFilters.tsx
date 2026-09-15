'use client'

import { useMemo, useState } from 'react'

import {
  CampaignListOmnibox,
  campaignListOmniboxFormClassName,
} from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  applySearchOnlyOmniboxSuggestion,
  buildSearchOnlyOmniboxChips,
  buildSearchOnlyOmniboxSuggestions,
  clearSearchOnlyOmnibox,
  removeSearchOnlyOmniboxChip,
  type SearchOnlyOmniboxAction,
} from '@/lib/searchOnlyListOmnibox'
import {
  buildSpeechCutListHref,
  type SpeechCutListState,
} from '@/utilities/speech/speechCutListUrl'

/**
 * C168 — the cut library only exposes free-text search over title/description
 * (no facets): the degenerate omnibox of `searchOnlyListOmnibox`, the same
 * chassis the other search-only lists use.
 */
export const SpeechCutLibraryFilters = ({ state }: { state: SpeechCutListState }) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildSpeechCutListHref(next, 1),
  })
  const [query, setQuery] = useState('')

  const withPageReset = (next: SpeechCutListState): SpeechCutListState => ({ ...next, page: 1 })
  const chips = useMemo(() => buildSearchOnlyOmniboxChips(state), [state])
  const suggestions = useMemo(() => buildSearchOnlyOmniboxSuggestions(query), [query])

  const runAction = (action: SearchOnlyOmniboxAction<SpeechCutListState>) => {
    if (action.kind === 'clear') setQuery('')
    navigate(action.state)
  }

  return (
    <form
      role="search"
      className={campaignListOmniboxFormClassName}
      onSubmit={(event) => {
        event.preventDefault()
      }}
    >
      <CampaignListOmnibox
        id="speech-cut-omnibox"
        label="Buscar corte por título ou descrição"
        placeholder="Buscar por título ou descrição…"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(
            applySearchOnlyOmniboxSuggestion({
              state,
              suggestionId,
              withPageReset,
            }),
          )
        }}
        onCommitQuery={(text) => {
          runAction(
            applySearchOnlyOmniboxSuggestion({
              state,
              suggestionId: `q:${text}`,
              withPageReset,
            }),
          )
        }}
        onRemoveChip={(chipId) => {
          runAction(removeSearchOnlyOmniboxChip({ state, chipId, withPageReset }))
        }}
        onClearAll={() => {
          runAction(clearSearchOnlyOmnibox({ cleared: { page: 1 } }))
        }}
      />
    </form>
  )
}
