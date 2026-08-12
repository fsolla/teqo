import { cleanup, render, screen, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GoogleCalendarSyncActionResult } from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import { ActivityUpdateFeed } from '@/components/campaign/activity/ActivityUpdateFeed'
import { GoogleCalendarSyncDialog } from '@/components/campaign/activity/GoogleCalendarSyncDialog'

const syncedState = (
  overrides: Partial<GoogleCalendarSyncActionResult> = {},
): GoogleCalendarSyncActionResult => ({
  ok: true,
  status: 'synced',
  calendarId: 'c_campanha@group.calendar.google.com',
  lastSyncedAt: '2026-08-11T12:00:00.000Z',
  lastSuccessAt: '2026-08-11T12:00:00.000Z',
  lastErrorAt: null,
  lastError: null,
  pushChannelExpiresAt: null,
  pushChannelError: null,
  addLink: 'https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2F…',
  ...overrides,
})

const renderDialog = (state: GoogleCalendarSyncActionResult) =>
  render(
    <GoogleCalendarSyncDialog
      open
      onOpenChange={vi.fn()}
      state={state}
      onSyncNow={vi.fn()}
      onSetDisabled={vi.fn()}
    />,
  )

const matchMediaMock = vi.fn()

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

beforeEach(() => {
  matchMediaMock.mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  vi.stubGlobal('matchMedia', matchMediaMock)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('GoogleCalendarSyncDialog — seção "Edições pelo Google" (C115)', () => {
  it('mostra a data de expiração do canal quando ativo', () => {
    renderDialog(syncedState({ pushChannelExpiresAt: '2026-09-10T12:00:00.000Z' }))
    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    expect(within(dialog).getByText(/Edições pelo Google/)).toBeTruthy()
    expect(within(dialog).getByText(/Notificações ativas até/)).toBeTruthy()
  })

  it('mostra o erro do canal quando a notificação falhou, sem prometer renovação', () => {
    renderDialog(syncedState({ pushChannelError: 'NEXT_PUBLIC_SITE_URL não configurada' }))
    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    expect(
      within(dialog).getByText(/Notificações de mudanças feitas no Google indisponíveis/),
    ).toBeTruthy()
    expect(within(dialog).queryByText(/Notificações ativas até/)).toBeNull()
  })

  it('não mostra a seção no estado não configurado', () => {
    renderDialog({
      ok: true,
      status: 'not-configured',
      calendarId: null,
      lastSyncedAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      pushChannelExpiresAt: null,
      pushChannelError: null,
      addLink: null,
    })
    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    expect(within(dialog).queryByText(/Edições pelo Google/)).toBeNull()
  })
})

describe('ActivityUpdateFeed — atribuição do registro reverso (C115)', () => {
  const renderFeed = (updates: Parameters<typeof ActivityUpdateFeed>[0]['updates']) =>
    render(<ActivityUpdateFeed updates={updates} />)

  it('atribui "Google Calendar" ao registro reverso sem autor', () => {
    renderFeed([
      {
        id: '1',
        body: 'Google Calendar: remarcada — antes 14/08 às 10:00, agora 14/08 às 16:00',
        authorName: null,
        createdAt: '2026-08-11T12:00:00.000Z',
      },
    ])
    expect(screen.getByText('Google Calendar')).toBeTruthy()
  })

  it('mantém "Autor removido" para entradas sem autor fora do prefixo', () => {
    renderFeed([
      {
        id: '2',
        body: 'Atualização de um autor que saiu da campanha',
        authorName: null,
        createdAt: '2026-08-11T12:00:00.000Z',
      },
    ])
    expect(screen.getByText('Autor removido')).toBeTruthy()
  })

  it('mantém o nome do autor quando presente (o prefixo não rouba a atribuição)', () => {
    renderFeed([
      {
        id: '3',
        body: 'Google Calendar: título alterado',
        authorName: 'Ana Coordenadora',
        createdAt: '2026-08-11T12:00:00.000Z',
      },
    ])
    expect(screen.getByText('Ana Coordenadora')).toBeTruthy()
  })
})
