import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CampaignHomeSearch } from '@/components/campaign/dashboard/CampaignHomeSearch'
import { HomeSearchProvider } from '@/components/campaign/dashboard/HomeSearchContext'
import { HomeSearchResultsProvider } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { HomeSearchResultsShell } from '@/components/campaign/dashboard/HomeSearchResultsShell'

const providerValue = {
  query: { raw: 'ca', debounced: 'ca', isActive: true },
  setRaw: vi.fn(),
  clear: vi.fn(),
  isDebouncing: false,
  inputFocused: false,
  setInputFocused: vi.fn(),
  uiFocused: true,
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
})
