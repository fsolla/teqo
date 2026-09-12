import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { CalendarFeedDialog } from '@/components/campaign/activity/CalendarFeedDialog'
import { TooltipProvider } from '@/components/ui/tooltip'

type DialogProps = Parameters<typeof CalendarFeedDialog>[0]

const FEED_URL = 'https://teqo.dev/campanha/agenda/ical/secret'

const renderDialog = (overrides: Partial<DialogProps> = {}) => {
  const onCreateFeed = vi.fn()
  const onRevokeFeed = vi.fn()
  render(
    <TooltipProvider delayDuration={300}>
      <CalendarFeedDialog
        open
        onOpenChange={vi.fn()}
        feeds={[]}
        onCreateFeed={onCreateFeed}
        onRevokeFeed={onRevokeFeed}
        {...overrides}
      />
    </TooltipProvider>,
  )
  return { onCreateFeed, onRevokeFeed }
}

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
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('CalendarFeedDialog (C93 — no filters needed)', () => {
  it('opens the naming form without any filter gate', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Sincronizar com Google Calendar')).toBeTruthy()
    expect(within(dialog).getByLabelText('Nome do feed')).toBeTruthy()
    expect(within(dialog).queryByText(/Aplique filtros/)).toBeNull()
  })

  it('creates the filterless feed through onCreateFeed with the chosen label', async () => {
    const { onCreateFeed } = renderDialog()
    onCreateFeed.mockResolvedValue({ ok: true, feedUrl: FEED_URL })

    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Nome do feed'), {
      target: { value: 'Agenda completa' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gerar link' }))

    await waitFor(() => expect(onCreateFeed).toHaveBeenCalledWith('Agenda completa'))
    await within(dialog).findByDisplayValue(FEED_URL)
  })

  it('mantém o conteúdo no corpo rolável e as ações no rodapé (C148)', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog')
    const body = dialog.querySelector('[data-slot="dialog-scroll-body"]')
    const footer = dialog.querySelector('[data-slot="dialog-footer"]')
    expect(body).toBeTruthy()
    expect(footer).toBeTruthy()
    expect(body!.contains(screen.getByLabelText('Nome do feed'))).toBe(true)
    expect(body!.contains(screen.getByRole('button', { name: 'Gerar link' }))).toBe(false)
    expect(footer!.contains(screen.getByRole('button', { name: 'Gerar link' }))).toBe(true)
  })

  it('no estado criado, o link fica no corpo e as ações no rodapé (C148)', async () => {
    const { onCreateFeed } = renderDialog()
    onCreateFeed.mockResolvedValue({ ok: true, feedUrl: FEED_URL })

    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Nome do feed'), {
      target: { value: 'Agenda completa' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gerar link' }))

    const link = await within(dialog).findByDisplayValue(FEED_URL)
    const body = dialog.querySelector('[data-slot="dialog-scroll-body"]')
    const footer = dialog.querySelector('[data-slot="dialog-footer"]')
    expect(body!.contains(link)).toBe(true)
    expect(body!.contains(screen.getByRole('link', { name: /Abrir Google Calendar/ }))).toBe(false)
    expect(footer!.contains(screen.getByRole('link', { name: /Abrir Google Calendar/ }))).toBe(true)
  })
})
