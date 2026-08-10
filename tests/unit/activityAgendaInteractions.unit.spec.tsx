import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadEvents: vi.fn(),
  reschedule: vi.fn(),
  createInline: vi.fn(),
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
  createActivityInline: (...args: unknown[]) => mocks.createInline(...args),
}))

vi.mock('@/app/(campaign)/campanha/(app)/atividades/contactSearchActions', () => ({
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
import { stubMatchMedia } from '../helpers/matchMedia'

const renderAgenda = (props: { state?: object } = {}) =>
  render(
    <CampaignPageChromeProvider role="coordinator">
      <ActivityAgenda state={props.state ?? {}} />
    </CampaignPageChromeProvider>,
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
    // inline-create spec uses. Stubbed per test because the afterEach below
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

  it('abre a criação inline no clique de um slot vazio, sem navegar', async () => {
    mocks.loadEvents.mockResolvedValue([])
    renderAgenda()

    await waitFor(() => expect(mocks.loadEvents).toHaveBeenCalled())
    expect(mocks.routerPush).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Clicar slot' }))

    const startTrigger = await screen.findByLabelText('Início *')
    // C97 — the overlay trigger is a button showing the civil label, 24h.
    expect(startTrigger.textContent).toBe('07/08/2026 às 13:00')
    expect(screen.getByLabelText('Término').textContent).toBe('07/08/2026 às 13:30')
    expect(mocks.routerPush).not.toHaveBeenCalled()
  })

  it('não exibe o aviso de janela vazia nem o botão de criação acima do calendário', async () => {
    mocks.loadEvents.mockResolvedValue([])
    renderAgenda()

    await waitFor(() => expect(mocks.loadEvents).toHaveBeenCalled())

    expect(screen.queryByText('Nenhum compromisso nesta janela e neste filtro.')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Criar atividade' })).toBeNull()
  })
})
