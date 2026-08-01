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

  it('bleeds home-actions edge-to-edge on mobile (compensates scroll p-4)', () => {
    const { container } = render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    const actions = container.querySelector('[data-slot="home-actions"]')
    expect(actions?.className).toContain('-mx-4')
    expect(actions?.className).toContain('w-[calc(100%+2rem)]')
    expect(actions?.className).toContain('md:mx-0')
    expect(actions?.className).toContain('md:w-auto')
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

  it('renders mobile thumb-zone spacer inside home-chrome above home-dock', () => {
    const { container } = render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    const chrome = container.querySelector('[data-slot="home-chrome"]')
    const spacer = chrome?.querySelector('[data-slot="home-thumb-spacer"]')
    expect(chrome).not.toBeNull()
    expect(spacer).not.toBeNull()
    expect(spacer?.getAttribute('aria-hidden')).toBe('true')
    expect(spacer?.className).toContain('flex-1')
    expect(spacer?.className).toContain('md:hidden')
    expect(chrome?.nextElementSibling?.getAttribute('data-slot')).toBe('home-dock')
  })

  it('retracts spacer, summary, and actions when focused but keeps search', () => {
    const { container } = render(
      <CampaignHomeLayout
        actions={<p>Actions block</p>}
        focused
        searchSlot={<p data-testid="home-search-stub">Search stub</p>}
        summarySlot={<p data-testid="home-summary-stub">Summary stub</p>}
      />,
    )

    const homeChrome = container.querySelector('[data-slot="home-chrome"]')
    expect(homeChrome?.getAttribute('data-retracted')).toBe('true')
    expect(homeChrome?.className).toContain('grid-rows-[0fr]')
    expect(homeChrome?.className).toContain('opacity-0')

    const actionsChrome = container.querySelector('[data-slot="home-actions-chrome"]')
    expect(actionsChrome?.getAttribute('data-retracted')).toBe('true')
    expect(actionsChrome?.className).toContain('grid-rows-[0fr]')

    expect(container.querySelector('[data-slot="home-thumb-spacer"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="home-summary"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="home-actions"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="home-search"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="home-dock"]')).not.toBeNull()
  })
})
