import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GoogleCalendarSyncActionResult } from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import { ActivityUpdateFeed } from '@/components/campaign/activity/ActivityUpdateFeed'
import { GoogleCalendarSyncDialog } from '@/components/campaign/activity/GoogleCalendarSyncDialog'

const syncedState = (
  overrides: Partial<GoogleCalendarSyncActionResult> = {},
): GoogleCalendarSyncActionResult => ({
  ok: true,
  canManageConnection: true,
  connection: 'connected',
  oauthAvailable: true,
  oauthConnectedAt: '2026-08-01T12:00:00.000Z',
  oauthError: null,
  status: 'synced',
  calendarId: 'c_campanha@group.calendar.google.com',
  lastSyncedAt: '2026-08-11T12:00:00.000Z',
  lastSuccessAt: '2026-08-11T12:00:00.000Z',
  lastErrorAt: null,
  lastError: null,
  pushChannelExpiresAt: null,
  pushChannelError: null,
  addLink: 'https://calendar.google.com/calendar/r?cid=c_campanha%40group.calendar.google.com',
  ...overrides,
})

const notConfiguredState = (
  overrides: Partial<GoogleCalendarSyncActionResult> = {},
): GoogleCalendarSyncActionResult => ({
  ok: true,
  canManageConnection: true,
  connection: 'not-configured',
  oauthAvailable: true,
  oauthConnectedAt: null,
  oauthError: null,
  status: 'not-configured',
  calendarId: null,
  lastSyncedAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  pushChannelExpiresAt: null,
  pushChannelError: null,
  addLink: null,
  ...overrides,
})

const renderDialog = (
  state: GoogleCalendarSyncActionResult,
  overrides: {
    onStartOAuth?: () => Promise<
      { ok: true; authorizeUrl: string } | { ok: false; message: string }
    >
    onDisconnect?: () => Promise<GoogleCalendarSyncActionResult>
    onOpenPicker?: () => void
  } = {},
) =>
  render(
    <GoogleCalendarSyncDialog
      open
      onOpenChange={vi.fn()}
      state={state}
      onSyncNow={vi.fn()}
      onSetDisabled={vi.fn()}
      onStartOAuth={overrides.onStartOAuth ?? vi.fn()}
      onDisconnect={overrides.onDisconnect ?? vi.fn()}
      onOpenPicker={overrides.onOpenPicker ?? vi.fn()}
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
    renderDialog(notConfiguredState())
    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    expect(within(dialog).queryByText(/Edições pelo Google/)).toBeNull()
  })
})

describe('GoogleCalendarSyncDialog — encaixe desktop (C148)', () => {
  it('mantém o conteúdo no corpo rolável e as ações no rodapé', () => {
    renderDialog(syncedState())

    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    const body = dialog.querySelector('[data-slot="dialog-scroll-body"]')
    const footer = dialog.querySelector('[data-slot="dialog-footer"]')
    expect(body).toBeTruthy()
    expect(footer).toBeTruthy()
    expect(body!.contains(screen.getByText(/Edições pelo Google/))).toBe(true)
    expect(body!.contains(screen.getByRole('button', { name: /Sincronizar agora/ }))).toBe(false)
    expect(footer!.contains(screen.getByRole('button', { name: /Sincronizar agora/ }))).toBe(true)
    expect(footer!.contains(screen.getByRole('button', { name: 'Desativar' }))).toBe(true)
  })

  it('não renderiza rodapé quando não há ação (não configurado)', () => {
    renderDialog(notConfiguredState())

    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    expect(dialog.querySelector('[data-slot="dialog-footer"]')).toBeNull()
    expect(dialog.querySelector('[data-slot="dialog-scroll-body"]')).toBeTruthy()
  })
})

describe('GoogleCalendarSyncDialog — card de conexão OAuth (C149)', () => {
  it('offers the connect button when the OAuth client is configured', () => {
    renderDialog(notConfiguredState())
    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    expect(within(dialog).getByText('Não configurado')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: /Conectar com o Google/ })).toBeTruthy()
    // The service account remains documented as the technical fallback.
    expect(within(dialog).getByText(/service account continua disponível/)).toBeTruthy()
  })

  it('shows the handshake error with the one-click reconnect path', () => {
    renderDialog(
      syncedState({
        connection: 'error',
        oauthError: 'A conexão com o Google expirou ou foi revogada.',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    expect(within(dialog).getByText('Erro')).toBeTruthy()
    expect(within(dialog).getByText(/expirou ou foi revogada/)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: /Reconectar com o Google/ })).toBeTruthy()
  })

  it('disconnects from the card when connected', async () => {
    const onDisconnect = vi.fn(async () => notConfiguredState())
    renderDialog(syncedState(), { onDisconnect })

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }))

    await waitFor(() => expect(onDisconnect).toHaveBeenCalledTimes(1))
  })

  it('hides the connect/disconnect actions from non-managers (advisor)', () => {
    renderDialog(notConfiguredState({ canManageConnection: false }))
    expect(screen.queryByRole('button', { name: /Conectar com o Google/ })).toBeNull()
    expect(screen.getByText(/Somente candidato ou coordenação/)).toBeTruthy()
  })

  it('falls back to the admin runbook when the server has no OAuth client', () => {
    renderDialog(notConfiguredState({ oauthAvailable: false }))
    expect(screen.getByText(/service account do Teqo/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Conectar com o Google/ })).toBeNull()
  })
})

describe('GoogleCalendarSyncDialog — calendário principal e one-click (C150)', () => {
  it('shows the current calendar and the picker trigger to managers', () => {
    renderDialog(syncedState())
    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    expect(within(dialog).getByText('Calendário principal da campanha')).toBeTruthy()
    expect(within(dialog).getByText('c_campanha@group.calendar.google.com')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Trocar calendário principal' })).toBeTruthy()
  })

  it('opens the picker from the connection card', () => {
    const onOpenPicker = vi.fn()
    renderDialog(syncedState(), { onOpenPicker })

    fireEvent.click(screen.getByRole('button', { name: 'Trocar calendário principal' }))

    expect(onOpenPicker).toHaveBeenCalledTimes(1)
  })

  it('offers to choose when the connection is active but no calendar is set', () => {
    renderDialog(syncedState({ status: 'not-configured', calendarId: null, addLink: null }))
    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    expect(
      within(dialog).getByRole('button', { name: 'Escolher calendário principal' }),
    ).toBeTruthy()
    expect(within(dialog).getByText(/Escolha o calendário principal/)).toBeTruthy()
  })

  it('hides the picker trigger from non-managers and names the nucleus', () => {
    renderDialog(syncedState({ canManageConnection: false }))
    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    expect(within(dialog).queryByRole('button', { name: /calendário principal/ })).toBeNull()
    expect(within(dialog).getByText(/escolhido por candidato ou coordenação/)).toBeTruthy()
  })

  it('renders the one-click add link and the public iCal URL for the manual path', () => {
    renderDialog(syncedState())
    const dialog = screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    const addLink = within(dialog).getByRole('link', {
      name: /Adicionar ao meu Google Calendar/,
    })
    expect(addLink.getAttribute('href')).toBe(
      'https://calendar.google.com/calendar/r?cid=c_campanha%40group.calendar.google.com',
    )
    const icalInput = within(dialog).getByLabelText(
      'URL pública do calendário (Por URL, Apple Calendar e Outlook)',
    ) as HTMLInputElement
    expect(icalInput.value).toBe(
      'https://calendar.google.com/calendar/ical/c_campanha%40group.calendar.google.com/public/basic.ics',
    )
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
