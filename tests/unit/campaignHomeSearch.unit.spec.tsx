import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CampaignHomeSearch } from '@/components/campaign/dashboard/CampaignHomeSearch'
import { HomeSearchProvider } from '@/components/campaign/dashboard/HomeSearchContext'
import { HomeSearchResultsProvider } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { HomeSearchResultsShell } from '@/components/campaign/dashboard/HomeSearchResultsShell'
import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_SUGGEST_EMPTY_MESSAGE } from '@/lib/campaignHomeSearchMessages'

const providerValue = {
  query: { raw: 'ca', debounced: 'ca', isActive: true },
  setRaw: vi.fn(),
  clear: vi.fn(),
  isDebouncing: false,
  inputFocused: false,
  setInputFocused: vi.fn(),
  uiFocused: true,
}

const suggestFocusedProviderValue = {
  ...providerValue,
  query: { raw: '', debounced: '', isActive: false },
}

const suggestSuccessEmpty: HomeSearchSuccessResponse = {
  status: 'success',
  resultKind: 'suggest',
  municipalities: [],
  territories: [],
  advisors: [],
  leaderships: [],
  stateDeputies: [],
  activities: [],
  demands: [],
  scopeMunicipalities: [],
}

const suggestSuccessWithHits: HomeSearchSuccessResponse = {
  ...suggestSuccessEmpty,
  municipalities: [
    {
      kind: 'municipality',
      slug: 'salvador',
      name: 'Salvador',
      region: 'Região Metropolitana',
      priority: 'alta',
      votePosition2022: null,
    },
  ],
}

afterEach(() => {
  cleanup()
})

describe('CampaignHomeSearch', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders search input and results region', () => {
    render(
      <HomeSearchProvider value={providerValue}>
        <CampaignHomeSearch>
          <p>Group stub</p>
        </CampaignHomeSearch>
      </HomeSearchProvider>,
    )

    expect(screen.getByLabelText('Buscar na campanha')).toBeTruthy()
    expect((screen.getByLabelText('Buscar na campanha') as HTMLInputElement).placeholder).toBe(
      'Município, liderança, atividade…',
    )
    expect(screen.getByRole('region', { name: 'Resultados da busca' })).toBeTruthy()
    expect(screen.getByText('Group stub')).toBeTruthy()
  })

  it('supports discreet peek without placeholder and hidden results', () => {
    render(
      <HomeSearchProvider value={providerValue}>
        <CampaignHomeSearch placeholder="" showResults={false}>
          <p>Group stub</p>
        </CampaignHomeSearch>
      </HomeSearchProvider>,
    )

    expect((screen.getByLabelText('Buscar na campanha') as HTMLInputElement).placeholder).toBe('')
    const results = document.querySelector('[data-slot="home-search-results"]')
    expect(results).toBeTruthy()
    expect((results as HTMLElement).hidden).toBe(true)
  })
})

describe('HomeSearchResultsShell', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows skeleton rows while fetching without hits (B106)', () => {
    render(
      <HomeSearchProvider value={providerValue}>
        <HomeSearchResultsProvider
          value={{
            results: { status: 'loading' },
            isFetching: true,
            resultKind: 'idle',
          }}
        >
          <HomeSearchResultsShell>
            <p>Group stub</p>
          </HomeSearchResultsShell>
        </HomeSearchResultsProvider>
      </HomeSearchProvider>,
    )

    expect(screen.getByTestId('home-search-suggest-skeleton')).toBeTruthy()
    expect(screen.queryByText('Group stub')).toBeNull()
  })

  it('shows the honest empty message when suggest succeeds without hits (OPS29)', () => {
    render(
      <HomeSearchProvider value={suggestFocusedProviderValue}>
        <HomeSearchResultsProvider
          value={{
            results: { status: 'success', data: suggestSuccessEmpty },
            isFetching: false,
            resultKind: 'suggest',
          }}
        >
          <HomeSearchResultsShell>
            <p>Group stub</p>
          </HomeSearchResultsShell>
        </HomeSearchResultsProvider>
      </HomeSearchProvider>,
    )

    expect(screen.getByText(HOME_SEARCH_SUGGEST_EMPTY_MESSAGE)).toBeTruthy()
    expect(screen.queryByText('Nenhum resultado.')).toBeNull()
  })

  it('does not render the suggest empty message when suggest has hits (OPS29)', () => {
    render(
      <HomeSearchProvider value={suggestFocusedProviderValue}>
        <HomeSearchResultsProvider
          value={{
            results: { status: 'success', data: suggestSuccessWithHits },
            isFetching: false,
            resultKind: 'suggest',
          }}
        >
          <HomeSearchResultsShell>
            <p>Group stub</p>
          </HomeSearchResultsShell>
        </HomeSearchResultsProvider>
      </HomeSearchProvider>,
    )

    expect(screen.queryByText(HOME_SEARCH_SUGGEST_EMPTY_MESSAGE)).toBeNull()
    expect(screen.getByText('Group stub')).toBeTruthy()
  })

  it('keeps the suggest empty message out of the debounce window (OPS29)', () => {
    render(
      <HomeSearchProvider value={suggestFocusedProviderValue}>
        <HomeSearchResultsProvider
          value={{
            results: { status: 'success', data: suggestSuccessEmpty },
            isFetching: true,
            resultKind: 'suggest',
          }}
        >
          <HomeSearchResultsShell>
            <p>Group stub</p>
          </HomeSearchResultsShell>
        </HomeSearchResultsProvider>
      </HomeSearchProvider>,
    )

    expect(screen.getByTestId('home-search-suggest-skeleton')).toBeTruthy()
    expect(screen.queryByText(HOME_SEARCH_SUGGEST_EMPTY_MESSAGE)).toBeNull()
  })

  it('keeps the search-mode empty message for an active query without hits (OPS29)', () => {
    render(
      <HomeSearchProvider value={providerValue}>
        <HomeSearchResultsProvider
          value={{
            results: { status: 'success', data: { ...suggestSuccessEmpty, resultKind: 'search' } },
            isFetching: false,
            resultKind: 'search',
          }}
        >
          <HomeSearchResultsShell>
            <p>Group stub</p>
          </HomeSearchResultsShell>
        </HomeSearchResultsProvider>
      </HomeSearchProvider>,
    )

    expect(screen.getByText('Nenhum resultado.')).toBeTruthy()
    expect(screen.queryByText(HOME_SEARCH_SUGGEST_EMPTY_MESSAGE)).toBeNull()
  })
})
