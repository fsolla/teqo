import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  MunicipalityRelationEditor,
  type MunicipalityRelationMutationResult,
} from '@/components/campaign/shared/MunicipalityRelationEditor'
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

describe('MunicipalityRelationEditor optimistic reconcile', () => {
  it('adopts the newest sent response when concurrent toggles settle out of order', async () => {
    const pending: Array<(result: MunicipalityRelationMutationResult) => void> = []
    const onToggle = vi.fn(
      () =>
        new Promise<MunicipalityRelationMutationResult>((resolve) => {
          pending.push(resolve)
        }),
    )
    render(
      createElement(
        TooltipProvider,
        null,
        createElement(MunicipalityRelationEditor, {
          municipalityName: 'Seabra',
          currentIDs: [],
          options: [
            { id: 1, label: 'Álvaro Lima' },
            { id: 2, label: 'Beatriz Souza' },
          ],
          variant: 'popover',
          title: 'Gerenciar relações',
          description: 'Descrição.',
          searchPlaceholder: 'Buscar…',
          searchLabel: 'Buscar relação',
          savingMessage: 'Salvando relações.',
          saveErrorMessage: 'Falha ao salvar.',
          triggerLabel: (entries) => `Editar relações — ${entries.map((entry) => entry.label)}`,
          emptyState: createElement('span', null, 'Nenhuma'),
          createLabel: (name) => `Criar “${name}”`,
          onToggle,
          onCreate: vi.fn(),
        }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /Editar relações/ }))
    fireEvent.change(screen.getByLabelText('Buscar relação'), { target: { value: 'alv' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Álvaro Lima' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Beatriz Souza' }))

    expect(onToggle).toHaveBeenNthCalledWith(1, 1, true)
    expect(onToggle).toHaveBeenNthCalledWith(2, 2, true)
    pending[1]?.({ status: 'success', selectedIDs: [1, 2] })
    pending[0]?.({ status: 'success', selectedIDs: [1] })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Álvaro Lima,Beatriz Souza/ })).toBeTruthy(),
    )
  })

  it('does not duplicate a create adopted by server props before the request resolves', async () => {
    let resolveCreate: ((result: MunicipalityRelationMutationResult) => void) | undefined
    const onCreate = vi.fn(
      () =>
        new Promise<MunicipalityRelationMutationResult>((resolve) => {
          resolveCreate = resolve
        }),
    )
    const element = (currentIDs: number[], options: Array<{ id: number; label: string }>) =>
      createElement(
        TooltipProvider,
        null,
        createElement(MunicipalityRelationEditor, {
          municipalityName: 'Seabra',
          currentIDs,
          options,
          variant: 'popover',
          title: 'Gerenciar relações',
          description: 'Descrição.',
          searchPlaceholder: 'Buscar…',
          searchLabel: 'Buscar relação',
          savingMessage: 'Salvando relações.',
          saveErrorMessage: 'Falha ao salvar.',
          triggerLabel: (entries) => `Editar relações — ${entries.map((entry) => entry.label)}`,
          emptyState: createElement('span', null, 'Nenhuma'),
          createLabel: (name) => `Criar “${name}”`,
          onToggle: vi.fn(),
          onCreate,
        }),
      )
    const view = render(element([], []))

    fireEvent.click(screen.getByRole('button', { name: /Editar relações/ }))
    fireEvent.change(screen.getByLabelText('Buscar relação'), { target: { value: 'Nova Pessoa' } })
    fireEvent.click(await screen.findByRole('option', { name: /Criar “Nova Pessoa”/ }))
    view.rerender(element([7], [{ id: 7, label: 'Nova Pessoa' }]))
    resolveCreate?.({
      status: 'success',
      selectedIDs: [7],
      createdEntry: { id: 7, label: 'Nova Pessoa' },
    })

    await waitFor(() => {
      const trigger = screen.getByRole('button', { name: /Editar relações — Nova Pessoa/ })
      expect(trigger.querySelectorAll('[data-slot="avatar"]')).toHaveLength(1)
    })
  })

  it('uses known entries for display without making them selectable', async () => {
    render(
      createElement(
        TooltipProvider,
        null,
        createElement(MunicipalityRelationEditor, {
          municipalityName: 'Seabra',
          currentIDs: [7],
          knownEntries: [{ id: 7, label: 'Fora da elegibilidade' }],
          options: [],
          variant: 'popover',
          title: 'Gerenciar relações',
          description: 'Descrição.',
          searchPlaceholder: 'Buscar…',
          searchLabel: 'Buscar relação',
          savingMessage: 'Salvando relações.',
          saveErrorMessage: 'Falha ao salvar.',
          triggerLabel: (entries) => `Editar relações — ${entries.map((entry) => entry.label)}`,
          emptyState: createElement('span', null, 'Nenhuma'),
          createLabel: (name) => `Criar “${name}”`,
          onToggle: vi.fn(),
          onCreate: vi.fn(),
        }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /Fora da elegibilidade/ }))
    fireEvent.change(screen.getByLabelText('Buscar relação'), {
      target: { value: 'Fora da elegibilidade' },
    })
    expect(screen.queryByRole('option', { name: 'Fora da elegibilidade' })).toBeNull()
  })
})
