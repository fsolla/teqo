import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BarChart3 } from 'lucide-react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CampaignGlobalSearchProvider } from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import { CampaignQuickActionContextProvider } from '@/components/campaign/shell/CampaignQuickActionContext'
import { CampaignQuickActionsFab } from '@/components/campaign/shell/CampaignQuickActionsFab'
import { CampaignQuickActionsHost } from '@/components/campaign/shell/CampaignQuickActionsHost'
import { CampaignQuickActionsOverlay } from '@/components/campaign/shell/CampaignQuickActionsOverlay'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import { postCampaignJson } from '@/lib/campaignJsonRequest'

vi.mock('@/lib/campaignJsonRequest', () => ({
  postCampaignJson: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/campanha/municipios/foo',
}))

const idleSuggestPayload: HomeSearchSuccessResponse = {
  status: 'success',
  resultKind: 'suggest',
  municipalities: [],
  territories: [],
  advisors: [],
  leaderships: [],
  stateDeputies: [],
  activities: [],
  demands: [],
}

/** Priority-alta hit — mounts MunicipalityPriorityIndicator → CampaignHoverTooltip. */
const suggestWithPriorityPayload: HomeSearchSuccessResponse = {
  ...idleSuggestPayload,
  municipalities: [
    {
      kind: 'municipality',
      slug: 'cairu',
      name: 'Cairu',
      region: 'Baixo Sul',
      priority: 'alta',
      votePosition2022: null,
    },
  ],
}

const searchWithPriorityPayload: HomeSearchSuccessResponse = {
  ...suggestWithPriorityPayload,
  resultKind: 'search',
}

const matchMediaMock = vi.fn()

let innerWidthSpy: ReturnType<typeof vi.spyOn> | undefined

const stubMobileViewport = () => {
  innerWidthSpy = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375)
}

beforeEach(() => {
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
  innerWidthSpy?.mockRestore()
  innerWidthSpy = undefined
  vi.mocked(postCampaignJson).mockReset()
  vi.unstubAllGlobals()
})

/**
 * Mirrors campaign (app) layout: TooltipProvider wraps chrome that includes the
 * overlay (B126). Nested only around page children left focus→suggest crashing.
 */
const renderQuickActionsChrome = (ui: ReactNode) =>
  render(
    <TooltipProvider delayDuration={300}>
      <CampaignQuickActionContextProvider>
        <CampaignGlobalSearchProvider>{ui}</CampaignGlobalSearchProvider>
      </CampaignQuickActionContextProvider>
    </TooltipProvider>,
  )

const renderOverlay = (
  props: Partial<React.ComponentProps<typeof CampaignQuickActionsOverlay>> = {},
) =>
  renderQuickActionsChrome(
    <CampaignQuickActionsOverlay open actions={[]} onOpenChange={vi.fn()} {...props} />,
  )

describe('CampaignQuickActionsFab (B126)', () => {
  it('renders when closed and hides when overlay is open', () => {
    const { rerender } = render(<CampaignQuickActionsFab open={false} onOpenChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Ações rápidas' })).toBeTruthy()

    rerender(<CampaignQuickActionsFab open onOpenChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Ações rápidas' })).toBeNull()
  })
})

describe('CampaignQuickActionsOverlay (B126)', () => {
  it('opens desktop dialog with search above actions', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderOverlay({
      actions: [
        {
          id: 'test',
          label: 'Registrar',
          icon: BarChart3,
          description: 'Teste.',
          href: '/campanha',
        },
      ],
    })

    const search = screen.getByLabelText('Buscar na campanha')
    const actionsChrome = document.querySelector('[data-slot="quick-actions-chrome"]')
    const searchChrome = document.querySelector('[data-slot="quick-actions-search"]')
    expect(actionsChrome).not.toBeNull()
    expect(searchChrome).not.toBeNull()
    expect(actionsChrome?.parentElement?.className).toContain('md:order-2')
    expect(searchChrome?.className).toContain('md:order-1')
    expect(search.getAttribute('placeholder')).toBe('Município, liderança, atividade…')
    expect(screen.getByRole('region', { name: 'Resultados da busca' })).toBeTruthy()
  })

  it('renders actions in a 3-column grid inside the overlay chrome', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderOverlay({
      actions: [
        {
          id: 'test',
          label: 'Registrar',
          icon: BarChart3,
          description: 'Teste.',
          href: '/campanha',
        },
      ],
    })

    const chrome = document.querySelector('[data-slot="quick-actions-chrome"]')
    const list = chrome?.querySelector('ul[role="list"]')
    expect(list?.className).toContain('grid-cols-3')
    expect(list?.className).not.toMatch(/flex/)
    expect(chrome?.querySelector('[aria-label="Ações rápidas"]')).not.toBeNull()
  })

  it('posts home-search when the overlay query is active', async () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderOverlay()

    fireEvent.change(screen.getByLabelText('Buscar na campanha'), { target: { value: 'cairu' } })

    await waitFor(() => {
      expect(postCampaignJson).toHaveBeenCalledWith(
        '/campanha/home-search',
        { mode: 'search', query: 'cairu' },
        expect.any(AbortSignal),
      )
    })
  })

  it('focus posts suggest and renders priority hits without crashing (B102)', async () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: suggestWithPriorityPayload,
    })

    renderOverlay()

    fireEvent.focus(screen.getByLabelText('Buscar na campanha'))

    await waitFor(() => {
      expect(postCampaignJson).toHaveBeenCalledWith(
        '/campanha/home-search',
        { mode: 'suggest' },
        expect.any(AbortSignal),
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Sugestões' })).toBeTruthy()
      expect(screen.getByText('Cairu')).toBeTruthy()
      expect(screen.getByLabelText('Município prioritário')).toBeTruthy()
    })
  })

  it('typing keeps search results with priority hits mounted (B102)', async () => {
    vi.mocked(postCampaignJson).mockImplementation(async (_url, body) => {
      if (typeof body === 'object' && body !== null && 'mode' in body && body.mode === 'search') {
        return { ok: true, payload: searchWithPriorityPayload }
      }
      return { ok: true, payload: idleSuggestPayload }
    })

    renderOverlay()

    const input = screen.getByLabelText('Buscar na campanha')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ca' } })

    await waitFor(() => {
      expect(postCampaignJson).toHaveBeenCalledWith(
        '/campanha/home-search',
        { mode: 'search', query: 'ca' },
        expect.any(AbortSignal),
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Municípios' })).toBeTruthy()
      expect(screen.getByText('Cairu')).toBeTruthy()
      expect(screen.getByLabelText('Município prioritário')).toBeTruthy()
    })
  })

  it('hides the current municipality from overlay suggest hits (B109)', async () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: {
        ...suggestWithPriorityPayload,
        municipalities: [
          ...suggestWithPriorityPayload.municipalities,
          {
            kind: 'municipality' as const,
            slug: 'foo',
            name: 'Município Atual',
            region: 'Teste',
            priority: null,
            votePosition2022: null,
          },
        ],
      },
    })

    renderOverlay()

    fireEvent.focus(screen.getByLabelText('Buscar na campanha'))

    await waitFor(() => {
      expect(screen.getByText('Cairu')).toBeTruthy()
      expect(screen.queryByText('Município Atual')).toBeNull()
    })
  })

  it('adds top padding when search is focused in the overlay', async () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderOverlay({
      actions: [
        {
          id: 'test',
          label: 'Registrar',
          icon: BarChart3,
          description: 'Teste.',
          href: '/campanha',
        },
      ],
    })

    const searchChrome = document.querySelector('[data-slot="quick-actions-search"]')
    const input = screen.getByLabelText('Buscar na campanha')

    fireEvent.blur(input)
    await waitFor(() => {
      expect(searchChrome?.className).toContain('mt-4')
    })

    fireEvent.focus(input)

    await waitFor(() => {
      expect(searchChrome?.className).toContain('pt-4')
      expect(searchChrome?.className).not.toContain('mt-4')
    })
  })

  it('clears overlay search when closed', async () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    const onOpenChange = vi.fn()
    const { rerender } = renderQuickActionsChrome(
      <CampaignQuickActionsOverlay open onOpenChange={onOpenChange} actions={[]} />,
    )

    const input = screen.getByLabelText('Buscar na campanha') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'cairu' } })
    expect(input.value).toBe('cairu')

    rerender(
      <TooltipProvider delayDuration={300}>
        <CampaignQuickActionContextProvider>
          <CampaignGlobalSearchProvider>
            <CampaignQuickActionsOverlay open={false} onOpenChange={onOpenChange} actions={[]} />
          </CampaignGlobalSearchProvider>
        </CampaignQuickActionContextProvider>
      </TooltipProvider>,
    )
    rerender(
      <TooltipProvider delayDuration={300}>
        <CampaignQuickActionContextProvider>
          <CampaignGlobalSearchProvider>
            <CampaignQuickActionsOverlay open onOpenChange={onOpenChange} actions={[]} />
          </CampaignGlobalSearchProvider>
        </CampaignQuickActionContextProvider>
      </TooltipProvider>,
    )

    expect((screen.getByLabelText('Buscar na campanha') as HTMLInputElement).value).toBe('')
  })

  it('opens idle without autofocus and keeps actions visible (B146)', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderOverlay({
      actions: [
        {
          id: 'test',
          label: 'Registrar',
          icon: BarChart3,
          description: 'Teste.',
          href: '/campanha',
        },
      ],
    })

    const input = screen.getByLabelText('Buscar na campanha')
    const actionsChrome = document.querySelector('[data-slot="quick-actions-chrome"]')

    expect(document.activeElement).not.toBe(input)
    expect(actionsChrome?.getAttribute('data-retracted')).toBeNull()
    expect(actionsChrome?.className).not.toContain('grid-rows-[0fr]')
  })

  it('shows swipe handle and no dialog close on mobile (B146)', () => {
    stubMobileViewport()
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderOverlay()

    expect(document.querySelector('[data-slot="drawer-swipe-handle"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull()
  })

  it('reserves space for close button beside search on desktop (B146)', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderOverlay()

    const searchChrome = document.querySelector('[data-slot="quick-actions-search"]')
    expect(searchChrome?.className).toContain('md:pr-10')
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeTruthy()
  })

  it('uses mobile drawer with actions above search', () => {
    stubMobileViewport()
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderOverlay({
      actions: [
        {
          id: 'test',
          label: 'Registrar',
          icon: BarChart3,
          description: 'Teste.',
          href: '/campanha',
        },
      ],
    })

    const actionsChrome = document.querySelector('[data-slot="quick-actions-chrome"]')
    const searchChrome = document.querySelector('[data-slot="quick-actions-search"]')
    expect(actionsChrome).not.toBeNull()
    expect(searchChrome).not.toBeNull()
    expect(
      actionsChrome!.compareDocumentPosition(searchChrome!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('CampaignQuickActionsHost (B126)', () => {
  it('opens overlay from FAB and does not render persistent drawer chrome', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderQuickActionsChrome(<CampaignQuickActionsHost role="coordinator" />)

    expect(screen.getByRole('button', { name: 'Ações rápidas' })).toBeTruthy()
    expect(document.getElementById('CampaignQuickActionsOverlay')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Ações rápidas' }))
    expect(document.getElementById('CampaignQuickActionsOverlay')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Ações rápidas' })).toBeNull()
  })
})
