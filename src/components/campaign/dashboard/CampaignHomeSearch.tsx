'use client'

import type { ReactNode } from 'react'

import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { HOME_SEARCH_QUERY_MAX_LENGTH } from '@/lib/schemas/homeSearch'

const HOME_SEARCH_INPUT_ID = 'homeSearchQuery'
const HOME_SEARCH_LABEL = 'Buscar na campanha'
const HOME_SEARCH_PLACEHOLDER = 'Município, liderança, atividade…'

export const CampaignHomeSearch = ({
  children,
  resultsBusy,
  placeholder = HOME_SEARCH_PLACEHOLDER,
  showResults = true,
}: {
  children?: ReactNode
  /** When set, must already fold debounce (see `useHomeSearchResultsState.isFetching`). */
  resultsBusy?: boolean
  /** Empty string = discreet peek (collapsed drawer); sr-only label stays. */
  placeholder?: string
  /** When false, keeps the live region mounted but visually hidden (collapsed peek). */
  showResults?: boolean
}) => {
  const { query, setRaw, clear, isDebouncing, setInputFocused } = useHomeSearch()
  const ariaBusy = (resultsBusy ?? isDebouncing) || undefined

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <CampaignSearchInput
        id={HOME_SEARCH_INPUT_ID}
        label={HOME_SEARCH_LABEL}
        placeholder={placeholder}
        value={query.raw}
        onChange={(event) => setRaw(event.target.value)}
        onFocus={() => setInputFocused(true)}
        onBlur={() => {
          if (!query.isActive) {
            setInputFocused(false)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            clear()
          }
        }}
        autoComplete="off"
        enterKeyHint="search"
        aria-busy={ariaBusy}
        maxLength={HOME_SEARCH_QUERY_MAX_LENGTH}
      />
      <div
        role="region"
        aria-live="polite"
        aria-label="Resultados da busca"
        aria-busy={ariaBusy}
        className="min-w-0"
        data-slot="home-search-results"
        hidden={!showResults}
      >
        {children}
      </div>
    </div>
  )
}
