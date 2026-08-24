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

describe('MunicipalityRelationEditor mutation queue (B160)', () => {
  it('serializes same-cell mutations: the second transport only fires after the first settles', async () => {
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
    fireEvent.change(screen.getByLabelText('Buscar relação'), { target: { value: 'bea' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Beatriz Souza' }))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith(1, true)
    expect(screen.getByLabelText('Salvando relações.')).toBeTruthy()

    pending[0]?.({ status: 'success', selectedIDs: [1] })

    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(2))
    expect(onToggle).toHaveBeenCalledWith(2, true)

    pending[1]?.({ status: 'success', selectedIDs: [1, 2] })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Álvaro Lima,Beatriz Souza/ })).toBeTruthy(),
    )
    expect(screen.queryByLabelText('Salvando relações.')).toBeNull()
  })

  it('reverts only the failed mutation delta; later mutations still fire and persist', async () => {
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
    fireEvent.change(screen.getByLabelText('Buscar relação'), { target: { value: 'bea' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Beatriz Souza' }))

    pending[0]?.({ status: 'error', message: 'Falha ao salvar.' })

    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(2))
    expect(onToggle).toHaveBeenCalledWith(2, true)
    await waitFor(() => expect(screen.queryByRole('button', { name: /Álvaro Lima/ })).toBeNull())

    pending[1]?.({ status: 'success', selectedIDs: [2] })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Editar relações — Beatriz Souza/ })).toBeTruthy(),
    )
    expect(screen.getAllByText('Falha ao salvar.').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Salvando relações.')).toBeNull()
  })

  it('applies the last confirmed state when the FINAL link fails (drain over the revert)', async () => {
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
    fireEvent.change(screen.getByLabelText('Buscar relação'), { target: { value: 'bea' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Beatriz Souza' }))

    pending[0]?.({ status: 'success', selectedIDs: [1] })
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(2))
    pending[1]?.({ status: 'error', message: 'Falha ao salvar.' })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Editar relações — Álvaro Lima' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Álvaro Lima,Beatriz/ })).toBeNull()
    })
    expect(screen.getAllByText('Falha ao salvar.').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Salvando relações.')).toBeNull()
  })

  it('reverts a failed create mid-queue and still fires the later link in order', async () => {
    const pending: Array<(result: MunicipalityRelationMutationResult) => void> = []
    const onToggle = vi.fn(
      () =>
        new Promise<MunicipalityRelationMutationResult>((resolve) => {
          pending.push(resolve)
        }),
    )
    const onCreate = vi.fn(
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
          options: [{ id: 1, label: 'Álvaro Lima' }],
          variant: 'popover',
          title: 'Gerenciar relações',
          description: 'Descrição.',
          searchPlaceholder: 'Buscar…',
          searchLabel: 'Buscar relação',
          savingMessage: 'Salvando relações.',
          saveErrorMessage: 'Falha ao salvar.',
          createErrorMessage: 'Falha ao criar.',
          triggerLabel: (entries) => `Editar relações — ${entries.map((entry) => entry.label)}`,
          emptyState: createElement('span', null, 'Nenhuma'),
          createLabel: (name) => `Criar “${name}”`,
          onToggle,
          onCreate,
        }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /Editar relações/ }))
    fireEvent.change(screen.getByLabelText('Buscar relação'), { target: { value: 'alv' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Álvaro Lima' }))
    fireEvent.change(screen.getByLabelText('Buscar relação'), {
      target: { value: 'Nova Pessoa' },
    })
    fireEvent.click(await screen.findByRole('option', { name: /Criar “Nova Pessoa”/ }))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onCreate).not.toHaveBeenCalled()

    pending[0]?.({ status: 'success', selectedIDs: [1] })

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate).toHaveBeenCalledWith('Nova Pessoa')

    pending[1]?.({ status: 'error', message: 'Falha ao criar.' })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Editar relações — Álvaro Lima' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Nova Pessoa/ })).toBeNull()
    })
    expect(screen.getAllByText('Falha ao criar.').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Salvando relações.')).toBeNull()
  })

  it('keeps optimistic state when the final response carries no selectedIDs (dobradinhas rely on RSC)', async () => {
    const pending: Array<(result: MunicipalityRelationMutationResult) => void> = []
    const onToggle = vi.fn(
      () =>
        new Promise<MunicipalityRelationMutationResult>((resolve) => {
          pending.push(resolve)
        }),
    )
    const element = (currentIDs: number[]) =>
      createElement(
        TooltipProvider,
        null,
        createElement(MunicipalityRelationEditor, {
          municipalityName: 'Seabra',
          currentIDs,
          options: [{ id: 1, label: 'Álvaro Lima' }],
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
      )
    const view = render(element([]))

    fireEvent.click(screen.getByRole('button', { name: /Editar relações/ }))
    fireEvent.change(screen.getByLabelText('Buscar relação'), { target: { value: 'alv' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Álvaro Lima' }))

    pending[0]?.({ status: 'success' })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Editar relações — Álvaro Lima/ })).toBeTruthy(),
    )

    view.rerender(element([1]))

    expect(screen.getByRole('button', { name: /Editar relações — Álvaro Lima/ })).toBeTruthy()
    expect(screen.queryByLabelText('Salvando relações.')).toBeNull()
  })

  it('keeps independent cells in parallel: two editors fire transports concurrently', async () => {
    const pending: Array<Array<(result: MunicipalityRelationMutationResult) => void>> = [[], []]
    const onToggleA = vi.fn(
      () =>
        new Promise<MunicipalityRelationMutationResult>((resolve) => {
          pending[0].push(resolve)
        }),
    )
    const onToggleB = vi.fn(
      () =>
        new Promise<MunicipalityRelationMutationResult>((resolve) => {
          pending[1].push(resolve)
        }),
    )
    const editor = (onToggle: typeof onToggleA) =>
      createElement(
        TooltipProvider,
        null,
        createElement(MunicipalityRelationEditor, {
          municipalityName: 'Seabra',
          currentIDs: [],
          options: [{ id: 1, label: 'Álvaro Lima' }],
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
      )
    render(createElement('div', null, editor(onToggleA), editor(onToggleB)))

    const triggers = screen.getAllByRole('button', { name: /Editar relações/ })
    fireEvent.click(triggers[0])
    fireEvent.click(await screen.findByRole('option', { name: 'Álvaro Lima' }))
    fireEvent.click(triggers[0])
    fireEvent.click(triggers[1])
    fireEvent.click(await screen.findByRole('option', { name: 'Álvaro Lima' }))

    expect(onToggleA).toHaveBeenCalledTimes(1)
    expect(onToggleB).toHaveBeenCalledTimes(1)

    pending[0][0]?.({ status: 'success', selectedIDs: [1] })
    pending[1][0]?.({ status: 'success', selectedIDs: [1] })

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Editar relações — Álvaro Lima/ })).toHaveLength(
        2,
      )
    })
  })

  it('keeps the pending confirmation when server props are adopted mid-flight (guard !drainingRef)', async () => {
    const pending: Array<(result: MunicipalityRelationMutationResult) => void> = []
    const onToggle = vi.fn(
      () =>
        new Promise<MunicipalityRelationMutationResult>((resolve) => {
          pending.push(resolve)
        }),
    )
    const element = (currentIDs: number[]) =>
      createElement(
        TooltipProvider,
        null,
        createElement(MunicipalityRelationEditor, {
          municipalityName: 'Seabra',
          currentIDs,
          options: [{ id: 1, label: 'Álvaro Lima' }],
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
      )
    const view = render(element([]))

    fireEvent.click(screen.getByRole('button', { name: /Editar relações/ }))
    fireEvent.change(screen.getByLabelText('Buscar relação'), { target: { value: 'alv' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Álvaro Lima' }))

    view.rerender(element([9]))

    pending[0]?.({ status: 'success', selectedIDs: [1] })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Editar relações — Álvaro Lima/ })).toBeTruthy(),
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
