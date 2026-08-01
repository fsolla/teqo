import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  it('shows global search in the expanded snap', async () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    const user = userEvent.setup()
    render(<CampaignQuickActionsDrawer actions={[]} />)

    expect(screen.queryByLabelText('Buscar na campanha')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Mostrar ações rápidas' }))

    expect(screen.getByLabelText('Buscar na campanha')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Resultados da busca' })).toBeTruthy()
  })

  it('posts home-search when the drawer query is active', async () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: idleSuggestPayload,
    })

    const user = userEvent.setup()
    render(<CampaignQuickActionsDrawer actions={[]} />)

    await user.click(screen.getByRole('button', { name: 'Mostrar ações rápidas' }))
    await user.type(screen.getByLabelText('Buscar na campanha'), 'cairu')

    await vi.waitFor(() => {
      expect(postCampaignJson).toHaveBeenCalledWith(
        '/campanha/home-search',
        { mode: 'search', query: 'cairu' },
        expect.any(AbortSignal),
      )
    })
  })
})
