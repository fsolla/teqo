import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { MunicipalityStateDeputyRelationCell } from '@/components/campaign/shared/MunicipalityStateDeputyRelationCell'
import { TooltipProvider } from '@/components/ui/tooltip'

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

afterEach(cleanup)

afterAll(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('MunicipalityStateDeputyRelationCell shared editor (B159)', () => {
  it('uses the campaign overlay and searches a deputy by party', async () => {
    const commitAction = vi.fn().mockResolvedValue({ status: 'success', message: 'Salvo.' })
    render(
      createElement(
        TooltipProvider,
        null,
        createElement(MunicipalityStateDeputyRelationCell, {
          municipalityId: 1,
          municipalityName: 'Seabra',
          stateDeputyIDs: [],
          options: [
            {
              id: 7,
              name: 'Beltrana (PSB)',
              plainName: 'Beltrana',
              party: 'PSB',
              slug: 'beltrana',
            },
          ],
          commitAction,
          createAction: vi.fn(),
          editorVariant: 'popover',
        }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar dobradinhas em Seabra' }))
    const dialog = await screen.findByRole('dialog', { name: 'Gerenciar dobradinhas' })
    fireEvent.change(within(dialog).getByLabelText('Buscar dobradinha'), {
      target: { value: 'psb' },
    })
    fireEvent.click(await within(dialog).findByRole('option', { name: 'Beltrana (PSB)' }))

    await waitFor(() => expect(commitAction).toHaveBeenCalledTimes(1))
    const formData = commitAction.mock.calls[0]?.[1] as FormData
    expect(Object.fromEntries(formData)).toEqual({
      municipalityId: '1',
      stateDeputyId: '7',
      assigned: 'true',
    })
    expect(
      screen.getByRole('button', { name: 'Editar dobradinhas em Seabra — Beltrana (PSB)' }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Beltrana (PSB)' }).getAttribute('href')).toBe(
      '/campanha/dobradinhas/beltrana',
    )
  })
})
