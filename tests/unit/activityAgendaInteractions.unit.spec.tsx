import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadEvents: vi.fn(),
  reschedule: vi.fn(),
  createOverlay: vi.fn(),
  updateOverlay: vi.fn(),
  loadEditDraft: vi.fn(),
  searchContacts: vi.fn(),
  searchResponsibles: vi.fn(),
  revertDrop: vi.fn(),
  revertResize: vi.fn(),
  routerPush: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@/app/(campaign)/campanha/actions/activity', () => ({
  loadActivityAgendaEvents: (...args: unknown[]) => mocks.loadEvents(...args),
  rescheduleActivity: (...args: unknown[]) => mocks.reschedule(...args),
  createActivityOverlay: (...args: unknown[]) => mocks.createOverlay(...args),
  updateActivityOverlay: (...args: unknown[]) => mocks.updateOverlay(...args),
  loadActivityEditDraft: (...args: unknown[]) => mocks.loadEditDraft(...args),
}))

vi.mock('@/app/(campaign)/campanha/(app)/atividades/contactSearchActions', () => ({
  searchActivityContactOptions: (query: string) => mocks.searchContacts(query),
  searchActivityResponsibleOptionsAction: (query: string) => mocks.searchResponsibles(query),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

type DateClickInfo = {
  allDay: boolean
  dateStr: string
  jsEvent: MouseEvent
}

type EventClickInfo = {
  event: { id: string }
  jsEvent: MouseEvent
}

type ScheduleMutationInfo = {
  event: { id: string; startStr: string; endStr: string }
  revert: () => void
}

type CalendarProps = {
  datesSet: (info: {
    startStr: string
    endStr: string
    view: { type: string; calendar: { getDate: () => Date } }
  }) => void
  eventDrop: (info: ScheduleMutationInfo) => void
  eventResize: (info: ScheduleMutationInfo) => void
  dateClick: (info: DateClickInfo) => void
  eventClick: (info: EventClickInfo) => void
}

vi.mock('@fullcalendar/react', () => {
  const CalendarMock = (props: CalendarProps) => {
    const { datesSet } = props
    useEffect(() => {
      datesSet({
        startStr: '2026-08-03T03:00:00.000Z',
        endStr: '2026-08-10T03:00:00.000Z',
        view: {
          type: 'timeGridWeek',
          calendar: { getDate: () => new Date('2026-08-03T03:00:00.000Z') },
        },
      })
    }, [datesSet])

    const event = {
      id: '7',
      startStr: '2026-08-07T13:00:00.000Z',
      endStr: '2026-08-07T14:00:00.000Z',
    }
    return createElement(
      'div',
      null,
      createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            props.dateClick({
              allDay: false,
              dateStr: '2026-08-07T13:00:00-03:00',
              jsEvent: new MouseEvent('click'),
            }),
        },
        'Clicar slot',
      ),
      createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            props.eventClick({
              event: { id: '7' },
              jsEvent: new MouseEvent('click'),
            }),
        },
        'Clicar evento',
      ),
      createElement(
        'button',
        { type: 'button', onClick: () => props.eventDrop({ event, revert: mocks.revertDrop }) },
        'Mover',
      ),
      createElement(
        'button',
        {
          type: 'button',
          onClick: () => props.eventResize({ event, revert: mocks.revertResize }),
        },
        'Redimensionar',
      ),
    )
  }
  return { default: CalendarMock }
})

import { ActivityAgenda, tagsLabel } from '@/components/campaign/activity/ActivityAgenda'
import { CampaignPageChromeProvider } from '@/components/campaign/shell/CampaignPageChromeContext'
import {
  CampaignQuickActionContextProvider,
  useCampaignQuickActionContext,
} from '@/components/campaign/shell/CampaignQuickActionContext'
import { stubMatchMedia } from '../helpers/matchMedia'

const renderAgenda = (props: { state?: object } = {}) =>
  render(
    <CampaignQuickActionContextProvider>
      <CampaignPageChromeProvider role="coordinator">
        <ActivityAgenda state={props.state ?? {}} />
      </CampaignPageChromeProvider>
    </CampaignQuickActionContextProvider>,
  )

describe('tagsLabel (C105)', () => {
  it('returns null without tags', () => {
    expect(tagsLabel([])).toBeNull()
  })

  it('prefixes tags with # and joins them', () => {
    expect(tagsLabel(['Caminhada'])).toBe('#Caminhada')
    expect(tagsLabel(['Caminhada', 'Imprensa'])).toBe('#Caminhada #Imprensa')
  })

  it('caps the row at two tags with a +N overflow', () => {
    expect(tagsLabel(['A', 'B', 'C'])).toBe('#A #B +1')
    expect(tagsLabel(['A', 'B', 'C', 'D'])).toBe('#A #B +2')
  })
})

describe('ActivityAgenda schedule failures', () => {
  // C101 — ActivityAgenda reads the viewport signal (useIsMobileMeasured);
  // jsdom has no matchMedia, so the harness pins the desktop layout (the
  // toolbar and the calendar body are what these tests exercise).
  beforeEach(() => {
    stubMatchMedia()
    // C104 — the toggle (radix Checkbox) measures its indicator via
    // react-use-size, which needs ResizeObserver — same stub the
    // overlay spec uses. Stubbed per test because the afterEach below
    // restores every stubGlobal.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('reverts a transport failure and releases the event for another attempt', async () => {
    mocks.loadEvents.mockResolvedValue([])
    mocks.reschedule.mockRejectedValue(new Error('transport failed'))
    renderAgenda()

    await waitFor(() => expect(mocks.loadEvents).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }))
    await waitFor(() => expect(mocks.revertDrop).toHaveBeenCalledOnce())
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Não foi possível remarcar a atividade. O horário anterior foi mantido.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mover' }))
    await waitFor(() => expect(mocks.reschedule).toHaveBeenCalledTimes(2))
  })

  it('reverts a refused resize with the safe server message', async () => {
    mocks.loadEvents.mockResolvedValue([])
    mocks.reschedule.mockResolvedValue({ ok: false, message: 'Remarcação recusada.' })
    renderAgenda()

    await waitFor(() => expect(mocks.loadEvents).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Redimensionar' }))

    await waitFor(() => expect(mocks.revertResize).toHaveBeenCalledOnce())
    expect(mocks.toastError).toHaveBeenCalledWith('Remarcação recusada.')
  })

  it('abre o overlay de criação no clique de um slot vazio, sem navegar', async () => {
    mocks.loadEvents.mockResolvedValue([])
    renderAgenda()

    await waitFor(() => expect(mocks.loadEvents).toHaveBeenCalled())
    expect(mocks.routerPush).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Clicar slot' }))

    // C123 — the slot click opens the central modal (dialog) with the split
    // date/time controls prefilled from the slot.
    expect(screen.getByRole('dialog', { name: 'Nova atividade' })).toBeTruthy()
    const startTrigger = await screen.findByLabelText('Início *')
    expect(startTrigger.textContent).toBe('07/08/2026')
    expect(screen.getByLabelText('Término').textContent).toBe('07/08/2026')
    expect(
      (screen.getByRole('combobox', { name: 'Hora de Início' }) as HTMLSelectElement).value,
    ).toBe('13')
    expect(mocks.routerPush).not.toHaveBeenCalled()
  })

  it('abre o overlay de edição no clique de um evento e carrega o rascunho (C123)', async () => {
    mocks.loadEvents.mockResolvedValue([])
    mocks.loadEditDraft.mockResolvedValue({
      id: 7,
      title: 'Comício na feira',
      slug: 'comicio-na-feira',
      tags: [],
      status: 'confirmado',
      description: null,
      deputyPresent: false,
      allDay: false,
      startAt: '2026-08-07T16:00:00.000Z',
      endAt: '2026-08-07T17:00:00.000Z',
      municipalityId: 12,
      locality: null,
      organizationIDs: [],
      responsibles: [],
      tasks: [],
    })
    renderAgenda()

    await waitFor(() => expect(mocks.loadEvents).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Clicar evento' }))

    await waitFor(() => expect(mocks.loadEditDraft).toHaveBeenCalledWith(7))
    expect(screen.getByRole('dialog', { name: 'Editar atividade' })).toBeTruthy()
    await waitFor(() =>
      expect((screen.getByLabelText('Título *') as HTMLInputElement).value).toBe(
        'Comício na feira',
      ),
    )
    expect(screen.getByRole('link', { name: 'Ver detalhes' }).getAttribute('href')).toBe(
      '/campanha/atividades/comicio-na-feira',
    )
  })

  it('não exibe o aviso de janela vazia nem o botão de criação acima do calendário', async () => {
    mocks.loadEvents.mockResolvedValue([])
    renderAgenda()

    await waitFor(() => expect(mocks.loadEvents).toHaveBeenCalled())

    // The empty-state notice and the old inline create CTA were removed by
    // C105/C91 respectively; the calendar shows FullCalendar's own text.
    expect(screen.queryByRole('link', { name: 'Criar atividade' })).toBeNull()
  })

  it('registra a ponte de criação no contexto de quick actions (C123)', async () => {
    mocks.loadEvents.mockResolvedValue([])
    let captured: (() => void) | undefined
    const Probe = () => {
      const { context } = useCampaignQuickActionContext()
      captured = context.openActivityCreate
      return null
    }
    render(
      <CampaignQuickActionContextProvider>
        <CampaignPageChromeProvider role="coordinator">
          <Probe />
          <ActivityAgenda state={{}} />
        </CampaignPageChromeProvider>
      </CampaignQuickActionContextProvider>,
    )

    await waitFor(() => expect(mocks.loadEvents).toHaveBeenCalled())
    await waitFor(() => expect(captured).toBeDefined())

    captured!()
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Nova atividade' })).toBeTruthy())
  })
})
