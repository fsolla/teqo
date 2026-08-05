import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { MunicipalityListLeadershipsControl } from '@/components/campaign/municipality/MunicipalityListLeadershipsControl'
import { TooltipProvider } from '@/components/ui/tooltip'
import { postCampaignJson } from '@/lib/campaignJsonRequest'

vi.mock('@/lib/campaignJsonRequest', () => ({ postCampaignJson: vi.fn() }))

const mockedPost = vi.mocked(postCampaignJson)

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

afterAll(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('MunicipalityListLeadershipsControl name-only create (B159)', () => {
  it('creates directly from the Command without rendering or sending phone', async () => {
    mockedPost.mockResolvedValue({
      ok: true,
      payload: {
        status: 'success',
        message: 'Liderança criada e vinculada.',
        leadershipIDs: [11],
        createdLeadership: { id: 11, name: 'Maria da Serra' },
      },
    })
    render(
      createElement(
        TooltipProvider,
        null,
        createElement(MunicipalityListLeadershipsControl, {
          municipalityID: 1,
          municipalityName: 'Seabra',
          currentLeadershipIDs: [],
          leadershipNamesById: new Map(),
          options: [],
          variant: 'sheet',
        }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /Editar lideranças em Seabra/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByLabelText(/Celular/)).toBeNull()
    fireEvent.change(within(dialog).getByLabelText('Buscar liderança'), {
      target: { value: 'Maria da Serra' },
    })
    fireEvent.click(await within(dialog).findByRole('option', { name: /Criar liderança/ }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/campanha/municipios/leaderships', {
        municipalityId: 1,
        name: 'Maria da Serra',
      }),
    )
    expect(screen.getByRole('button', { name: /Maria da Serra/ })).toBeTruthy()
  })
})
