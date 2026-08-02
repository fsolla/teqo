import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'

describe('CampaignHomeLayout', () => {
  it('fills the scrollport height on mobile', () => {
    const { container } = render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    expect(container.firstElementChild).not.toBeNull()
    expect(container.querySelector('[data-slot="home-dock"]')).not.toBeNull()
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
    expect(actions).not.toBeNull()
    expect(actions?.closest('[data-slot="home-actions-chrome"]')).not.toBeNull()
  })

  it('does not clip horizontal bleed on the actions retraction shell', () => {
    const { container } = render(<CampaignHomeLayout actions={<p>Actions block</p>} />)

    const actionsChrome = container.querySelector('[data-slot="home-actions-chrome"]')
    const bleedWrapper = actionsChrome?.querySelector('[data-allow-horizontal-bleed="true"]')
    expect(bleedWrapper).not.toBeNull()
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

    const actionsChrome = container.querySelector('[data-slot="home-actions-chrome"]')
    expect(actionsChrome?.getAttribute('data-retracted')).toBe('true')

    expect(container.querySelector('[data-slot="home-thumb-spacer"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="home-summary"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="home-actions"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="home-search"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="home-dock"]')).not.toBeNull()
  })
})
