import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { openAction, routerMock } = vi.hoisted(() => ({
  openAction: vi.fn(),
  routerMock: { refresh: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}))

vi.mock('@/app/(campaign)/campanha/actions/notifications', () => ({
  openCampaignNotifications: openAction,
}))

import { CampaignNotificationBell } from '@/components/campaign/shell/CampaignNotificationBell'
import type { NotificationListItem } from '@/lib/notificationContract'

const now = new Date().toISOString()

const items: NotificationListItem[] = [
  {
    id: 1,
    type: 'municipality_update',
    payload: {
      title: 'Nova atualização — Salvador ZE 01',
      detail: 'Fato de campo registrado',
      href: '/campanha/municipios/salvador-ze-01',
    },
    createdAt: now,
  },
  {
    id: 2,
    type: 'new_supporter',
    payload: {
      title: 'Convite aceito — Maria Souza',
      detail: 'Novo apoiador',
      href: '/campanha/apoiadores',
    },
    createdAt: now,
  },
]

const renderBell = (unreadCount = 2) =>
  render(<CampaignNotificationBell unreadCount={unreadCount} vapidPublicKey={null} />)

const matchMediaMock = vi.fn()

const stubMatchMedia = (matches: boolean) => {
  matchMediaMock.mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  vi.stubGlobal('matchMedia', matchMediaMock)
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
  Element.prototype.scrollIntoView = () => {}
})

beforeEach(() => {
  stubMatchMedia(false)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

afterAll(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('CampaignNotificationBell (C108 — read on open, clean panel, desktop dialog)', () => {
  it('opens the panel, marks everything read in one call and clears the badge', async () => {
    openAction.mockResolvedValue({ status: 'success', items, markedCount: 2 })
    renderBell()

    fireEvent.click(screen.getByRole('button', { name: '2 notificações não lidas' }))

    const dialog = await screen.findByRole('dialog', { name: 'Notificações' })
    expect(within(dialog).getByText('Nova atualização — Salvador ZE 01')).toBeTruthy()
    expect(within(dialog).getByText('Convite aceito — Maria Souza')).toBeTruthy()
    expect(openAction).toHaveBeenCalledTimes(1)

    // Badge zeroes as soon as the open action lands — no extra click. The bell
    // button sits outside the modal, so Radix marks it aria-hidden while the
    // dialog is open and role queries cannot see it — assert on the badge text.
    await waitFor(() => expect(screen.queryByText('2', { exact: true })).toBeNull())
  })

  it('re-syncs the sibling bell only when something was marked', async () => {
    openAction.mockResolvedValue({ status: 'success', items, markedCount: 2 })
    renderBell()

    fireEvent.click(screen.getByRole('button', { name: '2 notificações não lidas' }))
    await screen.findByRole('dialog', { name: 'Notificações' })
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1))
  })

  it('renders no title bar, counter, close button or mark-all button', async () => {
    openAction.mockResolvedValue({ status: 'success', items, markedCount: 2 })
    renderBell()

    fireEvent.click(screen.getByRole('button', { name: '2 notificações não lidas' }))

    const dialog = await screen.findByRole('dialog', { name: 'Notificações' })
    expect(within(dialog).queryByRole('button', { name: 'Marcar todas como lidas' })).toBeNull()
    expect(within(dialog).queryByText(/não lidas|Tudo em dia/)).toBeNull()
    // The only heading is the visually-hidden a11y title — the panel has no
    // visible title bar.
    expect(within(dialog).queryAllByRole('heading')).toHaveLength(1)
  })

  it('shows the empty state when there are no notifications', async () => {
    openAction.mockResolvedValue({ status: 'success', items: [], markedCount: 0 })
    renderBell(0)

    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }))

    const dialog = await screen.findByRole('dialog', { name: 'Notificações' })
    await within(dialog).findByText('Nenhuma notificação por aqui.')
    expect(routerMock.refresh).not.toHaveBeenCalled()
  })

  it('surfaces the load error instead of marking anything', async () => {
    openAction.mockResolvedValue({ message: 'Não foi possível carregar as notificações.' })
    renderBell()

    fireEvent.click(screen.getByRole('button', { name: '2 notificações não lidas' }))

    const dialog = await screen.findByRole('dialog', { name: 'Notificações' })
    await within(dialog).findByText('Não foi possível carregar as notificações.')
    expect(routerMock.refresh).not.toHaveBeenCalled()
  })
})

describe('CampaignNotificationBell (C108 — mobile bottom sheet)', () => {
  it('renders the sheet with the same clean panel', async () => {
    stubMatchMedia(true)
    openAction.mockResolvedValue({ status: 'success', items, markedCount: 0 })
    renderBell()

    fireEvent.click(screen.getByRole('button', { name: '2 notificações não lidas' }))

    const sheet = await screen.findByRole('dialog', { name: 'Notificações' })
    expect(within(sheet).getByText('Nova atualização — Salvador ZE 01')).toBeTruthy()
    expect(within(sheet).queryByRole('button', { name: 'Marcar todas como lidas' })).toBeNull()
    expect(within(sheet).queryAllByRole('heading')).toHaveLength(1)
  })
})
