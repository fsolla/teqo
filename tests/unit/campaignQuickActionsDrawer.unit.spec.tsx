import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BarChart3 } from 'lucide-react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CampaignGlobalSearchProvider } from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import { CampaignQuickActionContextProvider } from '@/components/campaign/shell/CampaignQuickActionContext'
import { CampaignQuickActionsDrawer } from '@/components/campaign/shell/CampaignQuickActionsDrawer'
import { CampaignContentScroll } from '@/components/campaign/shell/CampaignQuickActionsHost'
import {
  CampaignQuickActionsSnapProvider,
  useCampaignQuickActionsSnap,
} from '@/components/campaign/shell/CampaignQuickActionsSnapContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  QUICK_ACTIONS_SCROLL_COLLAPSE_THRESHOLD_PX,
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_DOCK,
  QUICK_ACTIONS_SNAP_FULL,
  quickActionsScrollDirection,
  quickActionsSnapIsDock,
  quickActionsSnapIsFull,
} from '@/lib/campaignQuickActionSnap'

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
  vi.mocked(postCampaignJson).mockReset()
  vi.unstubAllGlobals()
})

/**
 * Mirrors campaign (app) layout: TooltipProvider wraps chrome that includes the
 * drawer (B102). Nested only around page children left focus→suggest crashing.
 */
const renderQuickActionsChrome = (ui: ReactNode) =>
  render(
    <TooltipProvider delayDuration={300}>
      <CampaignQuickActionContextProvider>
        <CampaignQuickActionsSnapProvider>
          <CampaignGlobalSearchProvider>{ui}</CampaignGlobalSearchProvider>
        </CampaignQuickActionsSnapProvider>
      </CampaignQuickActionContextProvider>
    </TooltipProvider>,
  )

const SnapReadout = () => {
  const { snapPoint } = useCampaignQuickActionsSnap()
  return <div data-testid="snap">{snapPoint ?? 'null'}</div>
}

describe('CampaignQuickActionsDrawer (B105)', () => {
  it('loads in dock snap with handle above search and placeholder visible', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderQuickActionsChrome(<CampaignQuickActionsDrawer actions={[]} />)

    const context = document.getElementById('quickActionContext')
    expect(context?.getAttribute('data-snap')).toBe('dock')
    expect(context?.hasAttribute('hidden')).toBe(false)

    const handle = screen.getByRole('button', { name: 'Ocultar ações rápidas' })
    const search = screen.getByLabelText('Buscar na campanha')
    expect(handle.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(search.getAttribute('placeholder')).toBe('Município, liderança, atividade…')
    expect(screen.getByRole('region', { name: 'Resultados da busca' })).toBeTruthy()
  })

  it('collapsed peek keeps discreet search without placeholder; actions stay hidden', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderQuickActionsChrome(<CampaignQuickActionsDrawer actions={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar ações rápidas' }))
    expect(document.getElementById('quickActionContext')?.getAttribute('data-snap')).toBe(
      'collapsed',
    )

    const search = screen.getByLabelText('Buscar na campanha')
    expect(search.getAttribute('placeholder')).toBe('')
    const results = document.querySelector('[data-slot="home-search-results"]')
    expect(results).toBeTruthy()
    expect((results as HTMLElement).hidden).toBe(true)
    expect(screen.getByRole('button', { name: 'Mostrar ações rápidas' })).toBeTruthy()
  })

  it('bleeds the action strip edge-to-edge inside the drawer gutter (B101)', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderQuickActionsChrome(
      <CampaignQuickActionsDrawer
        actions={[
          {
            id: 'test',
            label: 'Registrar',
            icon: BarChart3,
            description: 'Teste.',
            href: '/campanha',
          },
        ]}
      />,
    )

    const context = document.getElementById('quickActionContext')
    const stripBleed = context?.firstElementChild
    expect(stripBleed).not.toBeNull()
    expect(stripBleed?.querySelector('[aria-label="Ações rápidas"]')).not.toBeNull()
  })

  it('posts home-search when the drawer query is active', async () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderQuickActionsChrome(<CampaignQuickActionsDrawer actions={[]} />)

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

    renderQuickActionsChrome(<CampaignQuickActionsDrawer actions={[]} />)

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

    renderQuickActionsChrome(<CampaignQuickActionsDrawer actions={[]} />)

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

  it('expands to full snap when the peek search is focused (B109)', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderQuickActionsChrome(<CampaignQuickActionsDrawer actions={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar ações rápidas' }))
    expect(document.getElementById('quickActionContext')?.getAttribute('data-snap')).toBe(
      'collapsed',
    )

    fireEvent.focus(screen.getByLabelText('Buscar na campanha'))
    expect(document.getElementById('quickActionContext')?.getAttribute('data-snap')).toBe('full')
  })

  it('stays full while search remains focused even if the handle collapses (B109)', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderQuickActionsChrome(<CampaignQuickActionsDrawer actions={[]} />)

    fireEvent.focus(screen.getByLabelText('Buscar na campanha'))
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar ações rápidas' }))
    expect(document.getElementById('quickActionContext')?.getAttribute('data-snap')).toBe('full')
  })

  it('toggles between dock and collapsed from the handle', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderQuickActionsChrome(<CampaignQuickActionsDrawer actions={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar ações rápidas' }))
    expect(document.getElementById('quickActionContext')?.getAttribute('data-snap')).toBe(
      'collapsed',
    )
    expect(screen.getByRole('button', { name: 'Mostrar ações rápidas' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar ações rápidas' }))
    expect(document.getElementById('quickActionContext')?.getAttribute('data-snap')).toBe('dock')
  })

  it('hides the current municipality from drawer suggest hits (B109)', async () => {
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

    renderQuickActionsChrome(<CampaignQuickActionsDrawer actions={[]} />)

    fireEvent.focus(screen.getByLabelText('Buscar na campanha'))

    await waitFor(() => {
      expect(screen.getByText('Cairu')).toBeTruthy()
      expect(screen.queryByText('Município Atual')).toBeNull()
    })
  })
})

describe('CampaignContentScroll quick-actions direction (B105)', () => {
  it('collapses on scroll down and re-docks on scroll up', () => {
    renderQuickActionsChrome(
      <>
        <CampaignContentScroll quickActionsPeek>
          <div style={{ height: '2000px' }} />
        </CampaignContentScroll>
        <SnapReadout />
      </>,
    )

    const scrollport = document.querySelector('[data-slot="campaign-content-scroll"]')
    expect(scrollport).toBeTruthy()
    expect(screen.getByTestId('snap').textContent).toBe(QUICK_ACTIONS_SNAP_DOCK)

    Object.defineProperty(scrollport, 'scrollTop', {
      configurable: true,
      value: QUICK_ACTIONS_SCROLL_COLLAPSE_THRESHOLD_PX + 1,
    })
    fireEvent.scroll(scrollport!)
    expect(screen.getByTestId('snap').textContent).toBe(QUICK_ACTIONS_SNAP_COLLAPSED)

    Object.defineProperty(scrollport, 'scrollTop', {
      configurable: true,
      value: 0,
    })
    fireEvent.scroll(scrollport!)
    expect(screen.getByTestId('snap').textContent).toBe(QUICK_ACTIONS_SNAP_DOCK)
  })
})

describe('campaignQuickActionSnap', () => {
  it('detects dock and full snaps', () => {
    expect(quickActionsSnapIsDock(QUICK_ACTIONS_SNAP_DOCK)).toBe(true)
    expect(quickActionsSnapIsDock(QUICK_ACTIONS_SNAP_COLLAPSED)).toBe(false)
    expect(quickActionsSnapIsDock(QUICK_ACTIONS_SNAP_FULL)).toBe(false)
    expect(quickActionsSnapIsDock(null)).toBe(false)
    expect(quickActionsSnapIsFull(QUICK_ACTIONS_SNAP_FULL)).toBe(true)
    expect(quickActionsSnapIsFull(QUICK_ACTIONS_SNAP_DOCK)).toBe(false)
  })

  it('resolves scroll direction from delta threshold', () => {
    expect(quickActionsScrollDirection(0, 25)).toBe('down')
    expect(quickActionsScrollDirection(80, 50)).toBe('up')
    expect(quickActionsScrollDirection(40, 50)).toBe('none')
  })
})
