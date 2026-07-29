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
}

describe('CampaignHomeLayout focused mode', () => {
  it('hides actions and thumb spacer when focused', () => {
    const { container } = render(
      <CampaignHomeLayout focused actions={<p>Actions block</p>} searchSlot={<p>Search</p>} />,
    )

    expect(container.querySelector('[data-slot="home-thumb-spacer"]')).toBeNull()
    expect(container.querySelector('[data-slot="home-actions"]')?.className).toContain('hidden')
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
