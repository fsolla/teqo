'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { SavePeopleFilterControl } from '@/components/campaign/people/SavePeopleFilterControl'
import {
  CampaignListOmnibox,
  campaignListOmniboxFormClassName,
} from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { SetCampaignHeaderAction } from '@/components/campaign/shell/CampaignPageChromeContext'
import {
  buildPeopleFilterHref,
  type PeopleFilterOption,
} from '@/utilities/people/peopleListFilters'
import type { PeopleListState } from '@/utilities/people/peopleListUrl'
import {
  applyPeopleOmniboxSuggestion,
  buildPeopleOmniboxChips,
  buildPeopleOmniboxSuggestionSeeds,
  clearPeopleOmnibox,
  filterPeopleOmniboxSuggestions,
  removePeopleOmniboxChip,
  type PeopleOmniboxAction,
} from '@/utilities/people/peopleOmnibox'

export const PeopleFilters = ({
  state,
  municipalityFilterOptions,
  trailing,
}: {
  state: PeopleListState
  municipalityFilterOptions: PeopleFilterOption[]
  trailing?: ReactNode
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: buildPeopleFilterHref,
  })
  const [query, setQuery] = useState('')

  const municipalityLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of municipalityFilterOptions) {
      const id = Number(option.value)
      if (Number.isSafeInteger(id) && id > 0) map.set(id, option.label)
    }
    for (const municipalityId of state.municipalities ?? []) {
      if (!map.has(municipalityId)) map.set(municipalityId, `Município #${municipalityId}`)
    }
    return map
  }, [municipalityFilterOptions, state.municipalities])

  const chips = useMemo(
    () => buildPeopleOmniboxChips({ state, municipalityLabelsById }),
    [state, municipalityLabelsById],
  )

  const suggestionSeeds = useMemo(
    () => buildPeopleOmniboxSuggestionSeeds({ municipalityFilterOptions }),
    [municipalityFilterOptions],
  )

  const suggestions = useMemo(
    () => filterPeopleOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: PeopleOmniboxAction) => {
    if (action.kind === 'clear') {
      setQuery('')
      navigate(action.state)
      return
    }
    navigate(action.state)
  }

  return (
    <>
      <form
        role="search"
        className={campaignListOmniboxFormClassName}
        onSubmit={(event) => {
          event.preventDefault()
        }}
      >
        <CampaignListOmnibox
          id="people-omnibox"
          label="Filtrar pessoas"
          placeholder="Buscar pessoa…"
          chips={chips}
          suggestions={suggestions}
          query={query}
          onQueryChange={setQuery}
          isPending={isPending}
          onSelectSuggestion={(suggestionId) => {
            runAction(applyPeopleOmniboxSuggestion({ state, suggestionId }))
          }}
          onCommitQuery={(text) => {
            runAction(applyPeopleOmniboxSuggestion({ state, suggestionId: `q:${text}` }))
          }}
          onRemoveChip={(chipId) => {
            runAction(removePeopleOmniboxChip({ state, chipId }))
          }}
          onClearAll={() => {
            runAction(clearPeopleOmnibox())
          }}
          trailing={
            <>
              {trailing}
              <SavePeopleFilterControl
                state={state}
                municipalityLabelsById={municipalityLabelsById}
                variant="trailing"
              />
            </>
          }
        />
      </form>
      {/* C100 mobile spec: "Salvar filtro" lives in the app header as an icon
          button; the trailing cluster is desktop-only below `md` (the omnibox
          hides its container below the breakpoint). Both instances share the
          same store, and only one is visible per breakpoint. */}
      <SetCampaignHeaderAction id="save-people-filter">
        <SavePeopleFilterControl
          state={state}
          municipalityLabelsById={municipalityLabelsById}
          variant="header"
        />
      </SetCampaignHeaderAction>
    </>
  )
}
