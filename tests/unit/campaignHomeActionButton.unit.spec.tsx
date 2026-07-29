import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BarChart3 } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CampaignHomeActionButton,
  type CampaignHomeActionButtonProps,
} from '@/components/campaign/dashboard/CampaignHomeActionButton'
import { CampaignHomeActionStrip } from '@/components/campaign/dashboard/CampaignHomeActionStrip'
import { TooltipProvider } from '@/components/ui/tooltip'
import { resetCampaignCoarsePointerForTests } from '@/lib/campaignCoarsePointer'
import { CAMPAIGN_LONG_PRESS_MS } from '@/lib/campaignLongPress'

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: React.ReactNode
    href: string
    onClick?: (event: React.MouseEvent) => void
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}))

const matchMediaMock = vi.fn()

beforeEach(() => {
  resetCampaignCoarsePointerForTests()
  matchMediaMock.mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  vi.stubGlobal('matchMedia', matchMediaMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const renderActionButton = (props: CampaignHomeActionButtonProps) =>
  render(
    <TooltipProvider>
      <CampaignHomeActionButton {...props} />
    </TooltipProvider>,
  )

describe('CampaignHomeActionButton', () => {
  it('exposes the label as the accessible name', () => {
    renderActionButton({ label: 'Registrar sinal', icon: BarChart3 })
    expect(screen.getByRole('button', { name: 'Registrar sinal' })).toBeTruthy()
  })

  it('fires onClick on a short tap when there is no description', () => {
    const onClick = vi.fn()
    renderActionButton({ label: 'Registrar', icon: BarChart3, onClick })

    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders an href on the link when provided', () => {
    renderActionButton({
      label: 'Ver cobertura',
      icon: BarChart3,
      description: 'Abre a lista filtrada.',
      href: '/campanha/municipios',
    })

    const link = screen.getByRole('link', { name: 'Ver cobertura' })
    expect(link.getAttribute('href')).toBe('/campanha/municipios')
  })

  it('marks disabled actions without a focusable control', () => {
    renderActionButton({ label: 'Em breve', icon: BarChart3, disabled: true })
    expect(screen.getByLabelText('Em breve').getAttribute('aria-disabled')).toBe('true')
  })

  it('opens the description drawer on long-press when the pointer is coarse', () => {
    resetCampaignCoarsePointerForTests()
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query.includes('coarse'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    vi.useFakeTimers()
    const onClick = vi.fn()
    renderActionButton({
      label: 'Ver cobertura',
      icon: BarChart3,
      description: 'Lista filtrada.',
      onClick,
    })

    const target = screen.getByRole('button', { name: 'Ver cobertura' })
    fireEvent.pointerDown(target, { button: 0, clientX: 0, clientY: 0 })
    act(() => {
      vi.advanceTimersByTime(CAMPAIGN_LONG_PRESS_MS)
    })
    expect(screen.getByText('Lista filtrada.')).toBeTruthy()

    fireEvent.pointerUp(target)
    fireEvent.click(target)
    expect(onClick).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('sets data-pressing on coarse pointer down before long-press fires', () => {
    resetCampaignCoarsePointerForTests()
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query.includes('coarse'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    renderActionButton({
      label: 'Ver cobertura',
      icon: BarChart3,
      description: 'Lista filtrada.',
      href: '/campanha/municipios',
    })

    const target = screen.getByRole('link', { name: 'Ver cobertura' })
    expect(target.getAttribute('data-pressing')).toBeNull()
    fireEvent.pointerDown(target, { button: 0, clientX: 0, clientY: 0 })
    expect(target.getAttribute('data-pressing')).toBe('true')
    fireEvent.pointerUp(target)
    expect(target.getAttribute('data-pressing')).toBeNull()
  })
})

describe('CampaignHomeActionStrip', () => {
  it('renders a horizontal scroller with list semantics', () => {
    const { container } = render(
      <CampaignHomeActionStrip
        actions={[
          { label: 'Um', icon: BarChart3 },
          { label: 'Dois', icon: BarChart3 },
        ]}
      />,
    )

    const scroller = container.querySelector('[aria-label="Ações rápidas"]')
    expect(scroller?.className).toContain('overflow-x-auto')
    expect(scroller?.className).toContain('scrollbar-width:none')
    expect(scroller?.querySelector('ul[role="list"]')).toBeTruthy()
  })
})
