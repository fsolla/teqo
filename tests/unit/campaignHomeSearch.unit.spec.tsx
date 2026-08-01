import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CampaignHomeSearch } from '@/components/campaign/dashboard/CampaignHomeSearch'
import { HomeSearchProvider } from '@/components/campaign/dashboard/HomeSearchContext'

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
  it('renders search input and results region', () => {
    render(
      <HomeSearchProvider value={providerValue}>
        <CampaignHomeSearch>
          <p>Group stub</p>
        </CampaignHomeSearch>
      </HomeSearchProvider>,
    )

    expect(screen.getByLabelText('Buscar na campanha')).toBeTruthy()
    expect(
      (screen.getByLabelText('Buscar na campanha') as HTMLInputElement).placeholder,
    ).toBe('Município, liderança, atividade…')
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
