'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { Button } from '@/components/ui/button'
import {
  applyActivityOmniboxSuggestion,
  buildActivityOmniboxChips,
  buildActivityOmniboxSuggestionSeeds,
  clearActivityOmnibox,
  filterActivityOmniboxSuggestions,
  removeActivityOmniboxChip,
  type ActivityOmniboxAction,
} from '@/utilities/activityOmnibox'
import {
  activityTabLabels,
  activityTabs,
  buildActivityListHref,
  buildActivityListSearchParams,
  type ActivityListState,
  type ActivityTab,
} from '@/utilities/activityUi'

const buildTabHref = (state: ActivityListState, tab: ActivityTab): string => {
  const params = buildActivityListSearchParams({
    page: 1,
    tab,
    kind: state.kind,
    status: tab === 'todos' ? state.status : undefined,
    municipality: state.municipality,
  })
  const query = params.toString()
  return query ? `/campanha/atividades?${query}` : '/campanha/atividades'
}

const ActivityTabSwitch = ({ state }: { state: ActivityListState }) => (
  <nav aria-label="Janela de atividades" className="flex flex-wrap gap-2">
    {activityTabs.map((tab) => {
      const active = tab === state.tab
      return (
        <Button
          key={tab}
          asChild
          variant={active ? 'default' : 'outline'}
          className="min-h-11 rounded-[6px]"
        >
          <Link href={buildTabHref(state, tab)} aria-current={active ? 'page' : undefined}>
            {activityTabLabels[tab]}
          </Link>
        </Button>
      )
    })}
  </nav>
)

export const ActivityFilters = ({
  state,
  municipalityOptions,
}: {
  state: ActivityListState
  municipalityOptions: RelationOption[]
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildActivityListHref(next, 1),
  })
  const [query, setQuery] = useState('')

  const municipalityLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of municipalityOptions) {
      if (Number.isSafeInteger(option.id) && option.id > 0) map.set(option.id, option.name)
    }
    return map
  }, [municipalityOptions])

  const municipalityFilterOptions = useMemo(
    () =>
      municipalityOptions.map((option) => ({
        value: String(option.id),
        label: option.name,
      })),
    [municipalityOptions],
  )

  const chips = useMemo(
    () => buildActivityOmniboxChips({ state, municipalityLabelsById }),
    [state, municipalityLabelsById],
  )

  const suggestionSeeds = useMemo(
    () =>
      buildActivityOmniboxSuggestionSeeds({
        tab: state.tab,
        municipalityOptions: municipalityFilterOptions,
      }),
    [state.tab, municipalityFilterOptions],
  )

  const suggestions = useMemo(
    () => filterActivityOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: ActivityOmniboxAction) => {
    if (action.kind === 'clear') {
      setQuery('')
      navigate(action.state)
      return
    }
    navigate(action.state)
  }

  return (
    <div className="flex flex-col gap-3">
      <ActivityTabSwitch state={state} />

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
        }}
      >
        <CampaignListOmnibox
          id="activity-omnibox"
          label="Filtrar atividades"
          placeholder="Digite para filtrar (tipo, status, município…)"
          chips={chips}
          suggestions={suggestions}
          query={query}
          onQueryChange={setQuery}
          isPending={isPending}
          onSelectSuggestion={(suggestionId) => {
            runAction(applyActivityOmniboxSuggestion({ state, suggestionId }))
          }}
          onRemoveChip={(chipId) => {
            runAction(removeActivityOmniboxChip({ state, chipId }))
          }}
          onClearAll={() => {
            runAction(clearActivityOmnibox(state))
          }}
        />
      </form>
    </div>
  )
}
