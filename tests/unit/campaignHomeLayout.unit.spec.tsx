import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'

describe('CampaignHomeLayout', () => {
  it('renders actions in the home-actions slot', () => {
    render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    expect(screen.getByText('Actions block').closest('[data-slot="home-actions"]')).not.toBeNull()
  })

  it('renders search slot when provided', () => {
    render(
      <CampaignHomeLayout
        actions={<p>Actions block</p>}
        searchSlot={<p data-testid="home-search-stub">Search stub</p>}
      />,
    )

    expect(
      screen.getByTestId('home-search-stub').closest('[data-slot="home-search"]'),
    ).not.toBeNull()
  })

  it('omits search slot when not provided', () => {
    const { container } = render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    expect(container.querySelector('[data-slot="home-search"]')).toBeNull()
  })

  it('renders mobile thumb-zone spacer above actions', () => {
    const { container } = render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    const spacer = container.querySelector('[data-slot="home-actions"]')?.previousElementSibling
    expect(spacer?.getAttribute('aria-hidden')).toBe('true')
    expect(spacer?.className).toContain('flex-1')
    expect(spacer?.className).toContain('md:hidden')
  })
})
