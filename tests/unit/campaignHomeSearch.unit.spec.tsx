import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'
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

describe('CampaignHomeLayout focused mode', () => {
  it('hides actions, thumb spacer, and summary when focused', () => {
    const { container } = render(
      <CampaignHomeLayout
        focused
        actions={<p>Actions block</p>}
        searchSlot={<p>Search</p>}
        summarySlot={<p>Summary block</p>}
      />,
    )

    expect(container.querySelector('[data-slot="home-thumb-spacer"]')).toBeNull()
    expect(container.querySelector('[data-slot="home-actions"]')?.className).toContain('hidden')
    expect(container.querySelector('[data-slot="home-summary"]')?.className).toContain('hidden')
  })

  it('shows summary when not focused', () => {
    render(
      <CampaignHomeLayout
        actions={<p>Actions block</p>}
        summarySlot={<p data-testid="home-summary-stub">Summary stub</p>}
      />,
    )

    expect(
      screen.getByTestId('home-summary-stub').closest('[data-slot="home-summary"]'),
    ).not.toBeNull()
  })
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
    expect(screen.getByRole('region', { name: 'Resultados da busca' })).toBeTruthy()
    expect(screen.getByText('Group stub')).toBeTruthy()
  })
})
