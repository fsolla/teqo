import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'

describe('CampaignHomeLayout', () => {
  it('fills the scrollport height on mobile', () => {
    const { container } = render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    const root = container.firstElementChild
    expect(root?.className).toContain('h-full')
    expect(root?.className).toContain('min-h-0')
  })

  it('renders actions in the home-actions slot inside home-dock', () => {
    const { container } = render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    const actions = container.querySelector('[data-slot="home-actions"]')
    expect(actions).not.toBeNull()
    expect(actions?.closest('[data-slot="home-dock"]')).not.toBeNull()
  })

  it('renders search slot inside home-dock when provided', () => {
    render(
      <CampaignHomeLayout
        actions={<p>Actions block</p>}
        searchSlot={<p data-testid="home-search-stub">Search stub</p>}
      />,
    )

    const search = screen.getByTestId('home-search-stub').closest('[data-slot="home-search"]')
    expect(search).not.toBeNull()
    expect(search?.closest('[data-slot="home-dock"]')).not.toBeNull()
  })

  it('omits search slot when not provided', () => {
    const { container } = render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    expect(container.querySelector('[data-slot="home-search"]')).toBeNull()
    expect(container.querySelector('[data-slot="home-dock"]')).not.toBeNull()
  })

  it('renders mobile thumb-zone spacer above home-dock', () => {
    const { container } = render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    const dock = container.querySelector('[data-slot="home-dock"]')
    const spacer = dock?.previousElementSibling
    expect(spacer?.getAttribute('data-slot')).toBe('home-thumb-spacer')
    expect(spacer?.getAttribute('aria-hidden')).toBe('true')
    expect(spacer?.className).toContain('flex-1')
    expect(spacer?.className).toContain('md:hidden')
  })

  it('hides spacer, summary, and actions when focused but keeps search', () => {
    const { container } = render(
      <CampaignHomeLayout
        actions={<p>Actions block</p>}
        focused
        searchSlot={<p data-testid="home-search-stub">Search stub</p>}
        summarySlot={<p data-testid="home-summary-stub">Summary stub</p>}
      />,
    )

    expect(container.querySelector('[data-slot="home-thumb-spacer"]')?.className).toContain(
      'hidden',
    )
    expect(container.querySelector('[data-slot="home-summary"]')?.className).toContain('hidden')
    expect(container.querySelector('[data-slot="home-actions"]')?.className).toContain('hidden')
    expect(container.querySelector('[data-slot="home-search"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="home-dock"]')).not.toBeNull()
  })
})
