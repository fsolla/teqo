'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { ContactCreateButton } from '@/components/campaign/contacts/ContactCreateState'
import {
  CampaignListOmnibox,
  campaignListOmniboxFormClassName,
} from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  buildContactFilterHref,
  type ContactFilterOption,
} from '@/utilities/contacts/contactListFilters'
import type { ContactListState } from '@/utilities/contacts/contactListUrl'
import {
  applyContactOmniboxSuggestion,
  buildContactOmniboxChips,
  buildContactOmniboxSuggestionSeeds,
  clearContactOmnibox,
  filterContactOmniboxSuggestions,
  removeContactOmniboxChip,
  type ContactOmniboxAction,
} from '@/utilities/contacts/contactOmnibox'

export const ContactFilters = ({
  state,
  cityFilterOptions,
  trailing,
}: {
  state: ContactListState
  cityFilterOptions: ContactFilterOption[]
  trailing?: ReactNode
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: buildContactFilterHref,
  })
  const [query, setQuery] = useState('')

  const chips = useMemo(() => buildContactOmniboxChips(state), [state])

  const suggestionSeeds = useMemo(
    () => buildContactOmniboxSuggestionSeeds({ cityFilterOptions }),
    [cityFilterOptions],
  )

  const suggestions = useMemo(
    () => filterContactOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: ContactOmniboxAction) => {
    if (action.kind === 'clear') {
      setQuery('')
      navigate(action.state)
      return
    }
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
        id="contact-omnibox"
        label="Filtrar contatos"
        placeholder="Buscar contato…"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyContactOmniboxSuggestion({ state, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(applyContactOmniboxSuggestion({ state, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeContactOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearContactOmnibox(state))
        }}
        trailing={
          <>
            {trailing}
            <ContactCreateButton />
          </>
        }
      />
    </form>
  )
}
