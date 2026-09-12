import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  GoogleCalendarListActionResult,
  GoogleCalendarSyncActionResult,
} from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import { GoogleCalendarPickerDialog } from '@/components/campaign/activity/GoogleCalendarPickerDialog'

/**
 * C150 — the primary-calendar picker: live list states (loading/error/empty),
 * the "em uso" mark, the confirm gating and the choose callback. Desktop
 * layout (matchMedia false); the mobile drawer shares the same content.
 */

const CALENDAR_A = 'c_campanha@group.calendar.google.com'
const CALENDAR_B = 'c_pessoal@group.calendar.google.com'

const listResult: GoogleCalendarListActionResult = {
  ok: true,
  calendars: [
    { id: CALENDAR_A, summary: 'Agenda da Campanha', primary: false },
    { id: CALENDAR_B, summary: 'Meu calendário', primary: true },
  ],
}

const syncResult = (
  overrides: Partial<GoogleCalendarSyncActionResult> = {},
): GoogleCalendarSyncActionResult => ({
  ok: true,
  canManageConnection: true,
  connection: 'connected',
  oauthAvailable: true,
  oauthConnectedAt: '2026-08-01T12:00:00.000Z',
  oauthError: null,
  status: 'synced',
  calendarId: CALENDAR_B,
  lastSyncedAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  pushChannelExpiresAt: null,
  pushChannelError: null,
  addLink: null,
  ...overrides,
})

const renderPicker = (
  overrides: {
    currentCalendarId?: string | null
    onOpenChange?: (open: boolean) => void
    onListCalendars?: () => Promise<GoogleCalendarListActionResult>
    onChooseCalendar?: (calendarId: string) => Promise<GoogleCalendarSyncActionResult>
  } = {},
) =>
  render(
    <GoogleCalendarPickerDialog
      open
      onOpenChange={overrides.onOpenChange ?? vi.fn()}
      currentCalendarId={overrides.currentCalendarId ?? CALENDAR_A}
      onListCalendars={overrides.onListCalendars ?? vi.fn(async () => listResult)}
      onChooseCalendar={overrides.onChooseCalendar ?? vi.fn(async () => syncResult())}
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

describe('GoogleCalendarPickerDialog (C150)', () => {
  it('shows the loading state while the live list is fetched', () => {
    renderPicker({
      onListCalendars: vi.fn((): Promise<GoogleCalendarListActionResult> => new Promise(() => {})),
    })

    expect(screen.getByText('Carregando calendários...')).toBeTruthy()
  })

  it('lists the calendars, marks the current one and disables the no-op confirm', async () => {
    renderPicker()

    const picker = await screen.findByRole('dialog', {
      name: /Calendário principal da campanha/,
    })
    const current = within(picker).getByRole('button', {
      name: /Agenda da Campanha/,
      pressed: true,
    })
    expect(current.getAttribute('aria-pressed')).toBe('true')
    expect(within(picker).getByText('em uso')).toBeTruthy()
    expect(within(picker).getByText('Calendário principal da conta')).toBeTruthy()

    const confirm = within(picker).getByRole('button', { name: 'Escolher calendário' })
    expect(confirm.hasAttribute('disabled')).toBe(true)
  })

  it('chooses another calendar and closes on success', async () => {
    const onOpenChange = vi.fn()
    const onChooseCalendar = vi.fn(async () => syncResult())
    renderPicker({ onOpenChange, onChooseCalendar })

    const picker = await screen.findByRole('dialog', {
      name: /Calendário principal da campanha/,
    })
    fireEvent.click(within(picker).getByRole('button', { name: /Meu calendário/ }))
    fireEvent.click(within(picker).getByRole('button', { name: 'Escolher calendário' }))

    await waitFor(() => expect(onChooseCalendar).toHaveBeenCalledWith(CALENDAR_B))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('keeps the picker open and shows the failure message', async () => {
    const onOpenChange = vi.fn()
    const onChooseCalendar = vi.fn(async () =>
      syncResult({ ok: false, message: 'O calendário escolhido não está mais disponível.' }),
    )
    renderPicker({ onOpenChange, onChooseCalendar })

    const picker = await screen.findByRole('dialog', {
      name: /Calendário principal da campanha/,
    })
    fireEvent.click(within(picker).getByRole('button', { name: /Meu calendário/ }))
    fireEvent.click(within(picker).getByRole('button', { name: 'Escolher calendário' }))

    expect(await within(picker).findByText(/não está mais disponível/)).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('offers a retry when the list fails', async () => {
    const onListCalendars = vi
      .fn<() => Promise<GoogleCalendarListActionResult>>()
      .mockResolvedValueOnce({ ok: false, message: 'Não foi possível listar os calendários.' })
      .mockResolvedValueOnce(listResult)
    renderPicker({ onListCalendars })

    expect(await screen.findByText('Não foi possível listar os calendários.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('Agenda da Campanha')).toBeTruthy()
    expect(onListCalendars).toHaveBeenCalledTimes(2)
  })

  it('shows the empty state when the account has no writable calendar', async () => {
    renderPicker({
      onListCalendars: vi.fn(
        async (): Promise<GoogleCalendarListActionResult> => ({ ok: true, calendars: [] }),
      ),
    })

    expect(
      await screen.findByText('Nenhum calendário com permissão de edição nesta conta Google.'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Escolher calendário' })).toBeNull()
  })

  it('maps a rejected list action to the error state with retry', async () => {
    const onListCalendars = vi
      .fn<() => Promise<GoogleCalendarListActionResult>>()
      .mockRejectedValueOnce(new Error('transport down'))
      .mockResolvedValueOnce(listResult)
    renderPicker({ onListCalendars })

    expect(await screen.findByText('Não foi possível listar os calendários agora.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Agenda da Campanha')).toBeTruthy()
  })

  it('maps a rejected choose action to an inline error without closing', async () => {
    const onOpenChange = vi.fn()
    const onChooseCalendar = vi
      .fn<() => Promise<GoogleCalendarSyncActionResult>>()
      .mockRejectedValueOnce(new Error('transport down'))
    renderPicker({ onOpenChange, onChooseCalendar })

    const picker = await screen.findByRole('dialog', {
      name: /Calendário principal da campanha/,
    })
    fireEvent.click(within(picker).getByRole('button', { name: /Meu calendário/ }))
    fireEvent.click(within(picker).getByRole('button', { name: 'Escolher calendário' }))

    expect(
      await within(picker).findByText(/Não foi possível escolher o calendário agora/),
    ).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
