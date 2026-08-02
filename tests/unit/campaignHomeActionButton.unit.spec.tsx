import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BarChart3 } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CampaignHomeActionButton,
  actionControlClassName,
  type CampaignHomeActionButtonProps,
} from '@/components/campaign/dashboard/CampaignHomeActionButton'
import {
  CampaignHomeActionStrip,
  HOME_ACTION_STRIP_DRAG_THRESHOLD_PX,
} from '@/components/campaign/dashboard/CampaignHomeActionStrip'
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

  it('exports a shared control class for two-line labels (B109)', () => {
    renderActionButton({ label: 'Registrar', icon: BarChart3 })
    const control = screen.getByRole('button', { name: 'Registrar' })
    for (const token of actionControlClassName.split(/\s+/).filter(Boolean)) {
      expect(control.className.split(/\s+/)).toContain(token)
    }
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
  const manyActions = Array.from({ length: 8 }, (_, index) => ({
    label: `Ação ${index + 1}`,
    icon: BarChart3,
  }))

  const getScroller = (container: HTMLElement) =>
    container.querySelector('[aria-label="Ações rápidas"]') as HTMLDivElement

  const mockScrollerOverflow = (scroller: HTMLDivElement) => {
    Object.defineProperty(scroller, 'scrollWidth', { value: 800, configurable: true })
    Object.defineProperty(scroller, 'clientWidth', { value: 200, configurable: true })
    scroller.scrollLeft = 0
  }

  it('renders a horizontal scroller with list semantics', () => {
    const { container } = render(
      <CampaignHomeActionStrip
        actions={[
          { label: 'Um', icon: BarChart3 },
          { label: 'Dois', icon: BarChart3 },
        ]}
      />,
    )

    const scroller = getScroller(container)
    expect(scroller).toBeTruthy()
    expect(scroller.getAttribute('aria-label')).toBe('Ações rápidas')
    const list = scroller.querySelector('ul[role="list"]')
    expect(list).toBeTruthy()
    expect(list?.querySelectorAll(':scope > li')).toHaveLength(2)
  })

  it('scrolls horizontally on pointer-fine drag past the threshold', () => {
    const { container } = render(<CampaignHomeActionStrip actions={manyActions} />)
    const scroller = getScroller(container)
    mockScrollerOverflow(scroller)

    const startX = 120
    const dragDelta = HOME_ACTION_STRIP_DRAG_THRESHOLD_PX + 20

    fireEvent.pointerDown(scroller, { button: 0, clientX: startX, pointerId: 1 })
    fireEvent.pointerMove(scroller, {
      button: 0,
      clientX: startX - dragDelta,
      pointerId: 1,
    })
    expect(scroller.scrollLeft).toBe(dragDelta)
    expect(scroller.dataset.dragging).toBe('true')

    fireEvent.pointerUp(scroller, { pointerId: 1 })
    expect(scroller.dataset.dragging).toBeUndefined()
  })

  it('does not pan on coarse pointer — touch uses native overflow scroll', () => {
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

    const onClick = vi.fn()
    const { container } = render(
      <CampaignHomeActionStrip
        actions={[{ label: 'Registrar', icon: BarChart3, onClick }, ...manyActions]}
      />,
    )
    const scroller = getScroller(container)
    mockScrollerOverflow(scroller)

    fireEvent.pointerDown(scroller, { button: 0, clientX: 200, pointerId: 4 })
    fireEvent.pointerMove(scroller, { button: 0, clientX: 50, pointerId: 4 })
    fireEvent.pointerUp(scroller, { pointerId: 4 })
    expect(scroller.scrollLeft).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('suppresses child click after a drag gesture', () => {
    const onClick = vi.fn()
    const { container } = render(
      <CampaignHomeActionStrip
        actions={[{ label: 'Registrar', icon: BarChart3, onClick }, ...manyActions.slice(0, 3)]}
      />,
    )
    const scroller = getScroller(container)
    mockScrollerOverflow(scroller)

    fireEvent.pointerDown(scroller, { button: 0, clientX: 200, pointerId: 2 })
    fireEvent.pointerMove(scroller, { button: 0, clientX: 100, pointerId: 2 })
    fireEvent.pointerUp(scroller, { pointerId: 2 })

    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('allows child click when movement stays below the drag threshold', () => {
    const onClick = vi.fn()
    const { container } = render(
      <CampaignHomeActionStrip actions={[{ label: 'Registrar', icon: BarChart3, onClick }]} />,
    )
    const scroller = getScroller(container)
    mockScrollerOverflow(scroller)

    const startX = 80
    fireEvent.pointerDown(scroller, { button: 0, clientX: startX, pointerId: 3 })
    fireEvent.pointerMove(scroller, {
      button: 0,
      clientX: startX - HOME_ACTION_STRIP_DRAG_THRESHOLD_PX + 2,
      pointerId: 3,
    })
    fireEvent.pointerUp(scroller, { pointerId: 3 })

    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('allows wizard link navigation after pointerdown/up without a drag gesture', () => {
    const onLinkClick = vi.fn()
    const { container } = render(
      <CampaignHomeActionStrip
        actions={[
          {
            label: 'Ajustar votos',
            icon: BarChart3,
            description: 'Atualizar projeção.',
            href: '/campanha/acoes/atualizar-votos',
          },
        ]}
      />,
    )
    const scroller = getScroller(container)
    mockScrollerOverflow(scroller)
    const link = screen.getByRole('link', { name: 'Ajustar votos' })
    link.onclick = onLinkClick

    fireEvent.pointerDown(link, { button: 0, clientX: 40, pointerId: 5 })
    fireEvent.pointerUp(link, { pointerId: 5 })
    fireEvent.click(link)

    expect(onLinkClick).toHaveBeenCalledTimes(1)
  })
})
