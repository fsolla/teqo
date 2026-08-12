import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createOverlay: vi.fn(),
  updateOverlay: vi.fn(),
  loadEditDraft: vi.fn(),
  searchContacts: vi.fn(),
  searchResponsibles: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@/app/(campaign)/campanha/actions/activity', () => ({
  createActivityOverlay: (...args: unknown[]) => mocks.createOverlay(...args),
  updateActivityOverlay: (...args: unknown[]) => mocks.updateOverlay(...args),
  loadActivityEditDraft: (...args: unknown[]) => mocks.loadEditDraft(...args),
}))

vi.mock('@/app/(campaign)/campanha/(app)/atividades/contactSearchActions', () => ({
  searchActivityContactOptions: (query: string) => mocks.searchContacts(query),
  searchActivityResponsibleOptionsAction: (query: string) => mocks.searchResponsibles(query),
}))

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

import {
  ActivityOverlay,
  type ActivityOverlayRequest,
} from '@/components/campaign/activity/ActivityOverlay'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import type { ActivityAgendaState } from '@/utilities/activityUi'
import type { ActivityFormViewModel } from '@/utilities/activityViewModels'

const CREATE_REQUEST: ActivityOverlayRequest = {
  kind: 'create',
  startAt: '2026-08-07T16:00:00.000Z',
  endAt: '2026-08-07T16:30:00.000Z',
}

const EDIT_VIEW_MODEL: ActivityFormViewModel = {
  id: 42,
  title: 'Comício na feira',
  slug: 'comicio-na-feira',
  tags: ['Comício'],
  status: 'confirmado',
  description: 'Panfletagem no centro histórico',
  deputyPresent: true,
  allDay: false,
  startAt: '2026-08-07T16:00:00.000Z',
  endAt: '2026-08-07T17:00:00.000Z',
  municipalityId: 12,
  locality: 'Centro histórico',
  organizationIDs: [7],
  responsibles: [],
  tasks: [],
}

const MUNICIPALITIES: RelationOption[] = [
  { id: 12, name: 'Camaçari' },
  { id: 13, name: 'Ilhéus' },
]

const ORGANIZATIONS: RelationOption[] = [{ id: 7, name: 'Sindmed' }]

const renderOverlay = ({
  request = CREATE_REQUEST,
  agendaState = {},
  isNarrow = false,
  knownTags = [],
  onSaved = vi.fn(),
  onClose = vi.fn(),
}: {
  request?: ActivityOverlayRequest | null
  agendaState?: ActivityAgendaState
  isNarrow?: boolean
  knownTags?: string[]
  onSaved?: () => void
  onClose?: () => void
} = {}) =>
  render(
    <ActivityOverlay
      request={request}
      isNarrow={isNarrow}
      agendaState={agendaState}
      municipalityOptions={MUNICIPALITIES}
      organizationOptions={ORGANIZATIONS}
      knownTags={knownTags}
      onClose={onClose}
      onSaved={onSaved}
    />,
  )

const submittedFormData = (): FormData => {
  const calls = mocks.createOverlay.mock.calls as unknown[][]
  expect(calls.length).toBeGreaterThan(0)
  return calls[0][0] as FormData
}

/**
 * Opens the calendar picker of a date trigger and returns the just-opened
 * dialog: the overlay dialog itself is a `role=dialog` too, so the picker is
 * always the LAST one in the tree (Radix portals mount in order).
 */
const openDatePicker = (label: string) => {
  fireEvent.click(screen.getByLabelText(label))
  return within(screen.getAllByRole('dialog').at(-1)!)
}

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

describe('ActivityOverlay — criação (modal central)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('preenche horários do slot (24h), usa o município do filtro ativo e mostra cada seção uma vez', () => {
    renderOverlay({ agendaState: { municipality: 12 } })

    expect(screen.getByLabelText('Início *').textContent).toBe('07/08/2026')
    expect(screen.getByLabelText('Término').textContent).toBe('07/08/2026')
    expect(
      (screen.getByRole('combobox', { name: 'Hora de Início' }) as HTMLSelectElement).value,
    ).toBe('13')
    expect(
      (screen.getByRole('combobox', { name: 'Minuto de Início' }) as HTMLSelectElement).value,
    ).toBe('00')
    expect(
      (screen.getByRole('combobox', { name: 'Hora de Término' }) as HTMLSelectElement).value,
    ).toBe('13')
    expect(
      (screen.getByRole('combobox', { name: 'Minuto de Término' }) as HTMLSelectElement).value,
    ).toBe('30')
    expect((screen.getByLabelText('Município *') as HTMLInputElement).value).toBe('Camaçari')

    // C123 — "Local" aparece uma única vez no overlay.
    expect(screen.getAllByLabelText('Local (opcional)')).toHaveLength(1)

    // Todas as seções do formulário completo estão no overlay.
    expect(screen.getByText('Informações básicas')).toBeTruthy()
    expect(screen.getByText('Data e horário')).toBeTruthy()
    expect(screen.getByText('Onde')).toBeTruthy()
    expect(screen.getByText('Pessoas e organizações')).toBeTruthy()
    // 'Tarefas' também é o label do campo de tarefas — card e campo convivem.
    expect(screen.getAllByText('Tarefas')).toHaveLength(2)
    expect(screen.getByText('Demandas')).toBeTruthy()
    expect(screen.getByLabelText('Descrição')).toBeTruthy()
    expect(screen.getByLabelText('Deputado presente')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: /Organizações apoiadoras/ })).toBeTruthy()
  })

  it('troca dia no calendário e hora/minuto nos selects inline, sem perder o outro eixo', () => {
    renderOverlay({ agendaState: { municipality: 12 } })

    const picker = openDatePicker('Início *')
    fireEvent.click(picker.getByRole('button', { name: /15 de agosto de 2026/ }))
    expect(screen.getByLabelText('Início *').textContent).toBe('15/08/2026')

    fireEvent.change(screen.getByRole('combobox', { name: 'Hora de Início' }), {
      target: { value: '09' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Minuto de Início' }), {
      target: { value: '45' },
    })

    const endPicker = openDatePicker('Término')
    fireEvent.click(endPicker.getByRole('button', { name: /15 de agosto de 2026/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Hora de Término' }), {
      target: { value: '16' },
    })
    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Café com apoiadores' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    const formData = submittedFormData()
    expect(formData.get('startAt')).toBe('2026-08-15T09:45')
    // O minuto do término preserva o prefill (30) — só a hora mudou.
    expect(formData.get('endAt')).toBe('2026-08-15T16:30')
  }, 20_000) // worker load the Radix close animations can push past the 5s default. // Two calendar popovers open in sequence (start then end); under parallel

  it('cria sem navegar, submete todas as seções e avisa o pai para recarregar', async () => {
    const onSaved = vi.fn()
    mocks.createOverlay.mockResolvedValue({ ok: true })
    renderOverlay({ agendaState: { municipality: 12 }, onSaved })

    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Café com apoiadores' },
    })
    fireEvent.change(screen.getByLabelText('Local (opcional)'), {
      target: { value: 'Centro histórico' },
    })
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'Café da manhã com lideranças' },
    })
    fireEvent.click(screen.getByLabelText('Deputado presente'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Minuto de Término' }), {
      target: { value: '45' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mocks.createOverlay).toHaveBeenCalledTimes(1))
    const formData = submittedFormData()
    expect(formData.get('title')).toBe('Café com apoiadores')
    expect(formData.get('municipality')).toBe('12')
    expect(formData.get('startAt')).toBe('2026-08-07T13:00')
    expect(formData.get('endAt')).toBe('2026-08-07T13:45')
    expect(formData.get('locality')).toBe('Centro histórico')
    expect(formData.get('description')).toBe('Café da manhã com lideranças')
    expect(formData.get('deputyPresent')).toBe('on')
    expect(formData.get('status')).toBe('confirmado')
    expect(formData.get('allDay')).toBeNull()
    expect(formData.get('id')).toBeNull()
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('bloqueia salvar sem município e não invoca a ação', async () => {
    const onSaved = vi.fn()
    mocks.createOverlay.mockResolvedValue({ ok: true })
    renderOverlay({ agendaState: {}, onSaved })

    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Café com apoiadores' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('Informe o município.')).toBeTruthy())
    expect(mocks.createOverlay).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('mantém o overlay aberto com erro inline quando a criação falha', async () => {
    const onSaved = vi.fn()
    const message = 'Já existe uma atividade com este título.'
    mocks.createOverlay.mockResolvedValue({
      ok: false,
      message,
      fieldErrors: { title: [message] },
    })
    renderOverlay({ agendaState: { municipality: 12 }, onSaved })

    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Café com apoiadores' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(message))
    await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0))
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('adiciona tags por Enter e as envia ao salvar (C105)', async () => {
    const onSaved = vi.fn()
    mocks.createOverlay.mockResolvedValue({ ok: true })
    renderOverlay({ agendaState: { municipality: 12 }, onSaved })

    const tagInput = screen.getByPlaceholderText('Ex.: comício, imprensa…')
    fireEvent.change(tagInput, { target: { value: 'Panfletagem' } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })
    expect(screen.getByLabelText('Remover tag Panfletagem')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Panfletagem no centro' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mocks.createOverlay).toHaveBeenCalledTimes(1))
    expect(JSON.parse(submittedFormData().get('tagsJson') as string)).toEqual(['Panfletagem'])
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('oferece as tags já usadas como sugestões (C105)', () => {
    renderOverlay({ agendaState: { municipality: 12 }, knownTags: ['Comício', 'Imprensa'] })

    const datalist = document.querySelector('datalist')
    const suggestionValues = [...(datalist?.querySelectorAll('option') ?? [])].map((option) =>
      option.getAttribute('value'),
    )
    expect(suggestionValues).toContain('Comício')
    expect(suggestionValues).toContain('Imprensa')
  })

  it('não renderiza nada sem um pedido de abertura', () => {
    const { container } = renderOverlay({ request: null })
    expect(container.firstChild).toBeNull()
  })

  it('fecha pelo botão Cancelar sem salvar', () => {
    const onClose = vi.fn()
    renderOverlay({ agendaState: { municipality: 12 }, onClose })

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.createOverlay).not.toHaveBeenCalled()
  })
})

describe('ActivityOverlay — edição (modal central)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('carrega o view model, pré-preenche tudo, trava o título e envia o id', async () => {
    const onSaved = vi.fn()
    mocks.loadEditDraft.mockResolvedValue(EDIT_VIEW_MODEL)
    mocks.updateOverlay.mockResolvedValue({ ok: true })
    renderOverlay({ request: { kind: 'edit', activityId: 42 }, onSaved })

    await waitFor(() =>
      expect((screen.getByLabelText('Título *') as HTMLInputElement).value).toBe(
        'Comício na feira',
      ),
    )
    expect(screen.getByRole('heading', { name: 'Editar atividade' })).toBeTruthy()
    expect(screen.getByLabelText('Início *').textContent).toBe('07/08/2026')
    expect(
      (screen.getByRole('combobox', { name: 'Hora de Início' }) as HTMLSelectElement).value,
    ).toBe('13')
    expect(
      (screen.getByRole('combobox', { name: 'Hora de Término' }) as HTMLSelectElement).value,
    ).toBe('14')
    expect((screen.getByLabelText('Município *') as HTMLInputElement).value).toBe('Camaçari')
    expect((screen.getByLabelText('Local (opcional)') as HTMLInputElement).value).toBe(
      'Centro histórico',
    )
    expect((screen.getByLabelText('Descrição') as HTMLInputElement).value).toBe(
      'Panfletagem no centro histórico',
    )
    expect((screen.getByLabelText('Título *') as HTMLInputElement).readOnly).toBe(true)
    expect(screen.getByText('Comício')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver detalhes' }).getAttribute('href')).toBe(
      '/campanha/atividades/comicio-na-feira',
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Minuto de Término' }), {
      target: { value: '30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(mocks.updateOverlay).toHaveBeenCalledTimes(1))
    const formData = mocks.updateOverlay.mock.calls[0][0] as FormData
    expect(formData.get('id')).toBe('42')
    expect(formData.get('title')).toBe('Comício na feira')
    expect(formData.get('startAt')).toBe('2026-08-07T13:00')
    expect(formData.get('endAt')).toBe('2026-08-07T14:30')
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('mostra estado de carregamento e depois o formulário', async () => {
    let resolveDraft: (value: ActivityFormViewModel) => void = () => undefined
    mocks.loadEditDraft.mockImplementation(
      () =>
        new Promise<ActivityFormViewModel>((resolve) => {
          resolveDraft = resolve
        }),
    )
    renderOverlay({ request: { kind: 'edit', activityId: 42 } })

    expect(screen.getByText('Carregando compromisso…')).toBeTruthy()
    resolveDraft(EDIT_VIEW_MODEL)
    await waitFor(() =>
      expect((screen.getByLabelText('Título *') as HTMLInputElement).value).toBe(
        'Comício na feira',
      ),
    )
  })

  it('mostra erro quando o rascunho não carrega e fecha pelo botão', async () => {
    const onClose = vi.fn()
    mocks.loadEditDraft.mockRejectedValue(new Error('Boom'))
    renderOverlay({ request: { kind: 'edit', activityId: 42 }, onClose })

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível carregar este compromisso. Tente novamente.'),
      ).toBeTruthy(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ActivityOverlay — sheet mobile (C103)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renderiza o sheet do topo com labels ocultos, hora inline e rodapé fixo', () => {
    renderOverlay({ agendaState: { municipality: 12 }, isNarrow: true })

    expect(screen.getByLabelText('Título *')).toBeTruthy()
    expect((screen.getByLabelText('Título *') as HTMLInputElement).placeholder).toBe(
      'Adicionar título *',
    )
    expect(screen.getByLabelText('Início *').textContent).toMatch(/^07\/08\/2026\*/)
    expect(
      (screen.getByRole('combobox', { name: 'Hora de Início' }) as HTMLSelectElement).value,
    ).toBe('13')
    expect(
      (screen.getByRole('combobox', { name: 'Minuto de Início' }) as HTMLSelectElement).value,
    ).toBe('00')
    expect((screen.getByLabelText('Município *') as HTMLInputElement).placeholder).toBe(
      'Município *',
    )
    expect((screen.getByLabelText('Local (opcional)') as HTMLInputElement).placeholder).toBe(
      'Local (opcional)',
    )
    expect(
      screen.getByRole('button', { name: 'Responsáveis: Adicionar responsáveis' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
  })

  it('abre o calendário como bottom sheet aninhado com Pronto; a hora fica inline', () => {
    renderOverlay({ agendaState: { municipality: 12 }, isNarrow: true })

    fireEvent.click(screen.getByLabelText('Início *'))
    const dialogs = screen.getAllByRole('dialog')
    const picker = within(dialogs[dialogs.length - 1])
    expect(picker.getByRole('button', { name: 'Pronto' })).toBeTruthy()

    fireEvent.click(picker.getByRole('button', { name: 'Pronto' }))
    expect(screen.queryByRole('button', { name: 'Pronto' })).toBeNull()
  })
})
