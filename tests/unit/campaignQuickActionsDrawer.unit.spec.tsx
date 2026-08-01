import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CampaignGlobalSearchProvider } from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import { CampaignQuickActionsDrawer } from '@/components/campaign/shell/CampaignQuickActionsDrawer'
import { CampaignContentScroll } from '@/components/campaign/shell/CampaignQuickActionsHost'
import {
  CampaignQuickActionsScrollCollapse,
  CampaignQuickActionsSnapProvider,
  useCampaignQuickActionsSnap,
} from '@/components/campaign/shell/CampaignQuickActionsSnapContext'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  QUICK_ACTIONS_SCROLL_COLLAPSE_THRESHOLD_PX,
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_DOCK,
  quickActionsSnapIsDock,
} from '@/lib/campaignQuickActionSnap'

vi.mock('@/lib/campaignJsonRequest', () => ({
  postCampaignJson: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/campanha/municipios/foo',
}))

const idleSuggestPayload = {
  status: 'success' as const,
  resultKind: 'suggest' as const,
  municipalities: [],
  territories: [],
  advisors: [],
  leaderships: [],
  stateDeputies: [],
  activities: [],
  demands: [],
}

const renderQuickActionsChrome = (ui: ReactNode) =>
  render(
    <CampaignQuickActionsSnapProvider>
      <CampaignGlobalSearchProvider>
        <CampaignQuickActionsScrollCollapse />
        {ui}
      </CampaignGlobalSearchProvider>
    </CampaignQuickActionsSnapProvider>,
  )

const SnapReadout = () => {
  const { snapPoint } = useCampaignQuickActionsSnap()
  return <div data-testid="snap">{snapPoint ?? 'null'}</div>
}

afterEach(() => {
  cleanup()
  vi.mocked(postCampaignJson).mockReset()
})

describe('CampaignQuickActionsDrawer (B100)', () => {
  it('loads in dock snap with global search visible', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    renderQuickActionsChrome(<CampaignQuickActionsDrawer actions={[]} />)

    const context = document.getElementById('quickActionContext')
    expect(context?.className).not.toContain('hidden')
    expect(context?.getAttribute('data-snap')).toBe('dock')
    expect(screen.getByLabelText('Buscar na campanha')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Resultados da busca' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ocultar ações rápidas' })).toBeTruthy()
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
})

describe('CampaignQuickActionsScrollCollapse (B100)', () => {
  it('collapses on content scroll down but not when scrolling back to top', () => {
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

    expect(screen.getByTestId('snap').textContent).toBe(QUICK_ACTIONS_SNAP_COLLAPSED)
  })
})

describe('campaignQuickActionSnap', () => {
  it('detects dock snap', () => {
    expect(quickActionsSnapIsDock(QUICK_ACTIONS_SNAP_DOCK)).toBe(true)
    expect(quickActionsSnapIsDock(QUICK_ACTIONS_SNAP_COLLAPSED)).toBe(false)
    expect(quickActionsSnapIsDock(null)).toBe(false)
  })
})
