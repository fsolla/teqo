import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CampaignQuickActionsDrawer } from '@/components/campaign/shell/CampaignQuickActionsDrawer'
import { postCampaignJson } from '@/lib/campaignJsonRequest'

vi.mock('@/lib/campaignJsonRequest', () => ({
  postCampaignJson: vi.fn(),
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

afterEach(() => {
  cleanup()
  vi.mocked(postCampaignJson).mockReset()
})

describe('CampaignQuickActionsDrawer (B91)', () => {
  it('shows global search in the expanded snap', () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    render(<CampaignQuickActionsDrawer actions={[]} />)

    const context = document.getElementById('quickActionContext')
    expect(context?.className).toContain('hidden')
    expect(context?.getAttribute('data-snap')).toBe('collapsed')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar ações rápidas' }))

    expect(context?.className).not.toContain('hidden')
    expect(context?.getAttribute('data-snap')).toBe('expanded')
    expect(screen.getByLabelText('Buscar na campanha')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Resultados da busca' })).toBeTruthy()
  })

  it('posts home-search when the drawer query is active', async () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    render(<CampaignQuickActionsDrawer actions={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar ações rápidas' }))
    fireEvent.change(screen.getByLabelText('Buscar na campanha'), { target: { value: 'cairu' } })

    await waitFor(() => {
      expect(postCampaignJson).toHaveBeenCalledWith(
        '/campanha/home-search',
        { mode: 'search', query: 'cairu' },
        expect.any(AbortSignal),
      )
    })
  })
})
