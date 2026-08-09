import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createInline: vi.fn(),
  searchResponsibles: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@/app/(campaign)/campanha/actions/activity', () => ({
  createActivityInline: (...args: unknown[]) => mocks.createInline(...args),
}))

vi.mock('@/app/(campaign)/campanha/(app)/atividades/contactSearchActions', () => ({
  searchActivityResponsibleOptionsAction: (query: string) => mocks.searchResponsibles(query),
}))

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

import {
  ActivityInlineCreate,
  type ActivityInlineCreateDraft,
} from '@/components/campaign/activity/ActivityInlineCreate'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import type { ActivityAgendaState } from '@/utilities/activityUi'

const DRAFT: ActivityInlineCreateDraft = {
  startAt: '2026-08-07T16:00:00.000Z',
  endAt: '2026-08-07T16:30:00.000Z',
  anchor: { x: 100, y: 200 },
}

const MUNICIPALITIES: RelationOption[] = [
  { id: 12, name: 'Camaçari' },
  { id: 13, name: 'Ilhéus' },
]

const renderOverlay = ({
  draft = DRAFT,
  agendaState = {},
  isNarrow = false,
  onCreated = vi.fn(),
  onClose = vi.fn(),
}: {
  draft?: ActivityInlineCreateDraft | null
  agendaState?: ActivityAgendaState
  isNarrow?: boolean
  onCreated?: () => void
  onClose?: () => void
} = {}) =>
  render(
    <ActivityInlineCreate
      draft={draft}
      isNarrow={isNarrow}
      agendaState={agendaState}
      municipalityOptions={MUNICIPALITIES}
      onClose={onClose}
      onCreated={onCreated}
    />,
  )

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('ActivityInlineCreate — overlay de criação inline', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('preenche horários do slot (24h) e usa o município do filtro ativo', () => {
    renderOverlay({ agendaState: { municipality: 12 } })

    // C97 — the native datetime-local is gone: the trigger button shows the
    // civil label, 24h by construction (no browser locale can inject AM/PM).
    expect(screen.getByLabelText('Início *').textContent).toBe('07/08/2026 às 13:00')
    expect(screen.getByLabelText('Término').textContent).toBe('07/08/2026 às 13:30')
    expect((screen.getByLabelText('Município *') as HTMLInputElement).value).toBe('Camaçari')
  })

  it('troca dia no calendário e hora/minuto nos passos, sem perder o outro eixo', () => {
    renderOverlay({ agendaState: { municipality: 12 } })

    fireEvent.click(screen.getByLabelText('Início *'))
    const dialogs = screen.getAllByRole('dialog')
    const picker = within(dialogs[dialogs.length - 1])

    fireEvent.click(picker.getByRole('button', { name: /15 de agosto de 2026/ }))
    expect(screen.getByLabelText('Início *').textContent).toBe('15/08/2026 às 13:00')

    fireEvent.change(picker.getByRole('combobox', { name: 'Hora' }), {
      target: { value: '09' },
    })
    expect(screen.getByLabelText('Início *').textContent).toBe('15/08/2026 às 09:00')

    fireEvent.change(picker.getByRole('combobox', { name: 'Minuto' }), {
      target: { value: '45' },
    })
    expect(screen.getByLabelText('Início *').textContent).toBe('15/08/2026 às 09:45')
  })

  it('cria sem navegar e avisa o pai para recarregar a janela', async () => {
    const onCreated = vi.fn()
    mocks.createInline.mockResolvedValue({ ok: true })
    renderOverlay({ agendaState: { municipality: 12 }, onCreated })

    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Café com apoiadores' },
    })
    fireEvent.change(screen.getByLabelText('Local (opcional)'), {
      target: { value: 'Centro histórico' },
    })
    fireEvent.click(screen.getByLabelText('Término'))
    const dialogs = screen.getAllByRole('dialog')
    const endPicker = within(dialogs[dialogs.length - 1])
    fireEvent.change(endPicker.getByRole('combobox', { name: 'Minuto' }), {
      target: { value: '45' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mocks.createInline).toHaveBeenCalledTimes(1))
    expect(mocks.createInline).toHaveBeenCalledWith({
      title: 'Café com apoiadores',
      municipality: 12,
      startAt: '2026-08-07T16:00:00.000Z',
      endAt: '2026-08-07T16:45:00.000Z',
      locality: 'Centro histórico',
    })
    expect(onCreated).toHaveBeenCalledTimes(1)
  })

  it('bloqueia salvar sem município e não invoca a ação', async () => {
    const onCreated = vi.fn()
    mocks.createInline.mockResolvedValue({ ok: true })
    renderOverlay({ agendaState: {}, onCreated })

    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Café com apoiadores' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('Informe o município.')).toBeTruthy())
    expect(mocks.createInline).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('mantém o overlay aberto com erro inline quando a criação falha', async () => {
    const onCreated = vi.fn()
    const message = 'Já existe uma atividade com este título.'
    mocks.createInline.mockResolvedValue({
      ok: false,
      message,
      fieldErrors: { title: [message] },
    })
    renderOverlay({ agendaState: { municipality: 12 }, onCreated })

    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Café com apoiadores' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(message))
    await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0))
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('monta o href de "Mais detalhes" com município e título digitados', () => {
    renderOverlay({ agendaState: { municipality: 12 } })

    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Café com apoiadores' },
    })
    const link = screen.getByRole('link', { name: 'Mais detalhes' })
    expect(link.getAttribute('href')).toBe(
      '/campanha/atividades/nova?startAt=2026-08-07T16%3A00%3A00.000Z&endAt=2026-08-07T16%3A30%3A00.000Z&municipality=12&title=Caf%C3%A9+com+apoiadores&returnTo=%2Fcampanha%2Fagenda%3Fmunicipality%3D12',
    )
  })

  it('não renderiza nada sem um rascunho de slot', () => {
    const { container } = renderOverlay({ draft: null })
    expect(container.firstChild).toBeNull()
  })

  it('renderiza o mesmo conteúdo no bottom sheet mobile', () => {
    renderOverlay({ agendaState: { municipality: 12 }, isNarrow: true })

    expect(screen.getByLabelText('Título *')).toBeTruthy()
    expect(screen.getByLabelText('Início *').textContent).toBe('07/08/2026 às 13:00')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
  })
})
