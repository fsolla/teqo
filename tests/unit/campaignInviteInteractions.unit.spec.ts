import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LeadershipInviteDialog } from '@/components/campaign/LeadershipInviteDialog'
import { LeadershipInviteDialogShell } from '@/components/campaign/LeadershipInviteDialogShell'

class TestResizeObserver {
  observe = () => undefined
  unobserve = () => undefined
  disconnect = () => undefined
}

globalThis.ResizeObserver ??= TestResizeObserver

describe('campaign invite interactions', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('creates, copies, and opens the generated WhatsApp link', async () => {
    const whatsappUrl =
      'https://wa.me/5571999990000?text=Convite%20https%3A%2F%2Fexample.com%2Fcampanha%2Fconvite%2Fsecret'
    const createInviteAction = vi.fn(async () => ({
      inviteUrl: 'https://example.com/campanha/convite/secret',
      whatsappUrl,
    }))
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)

    const InviteDialogWithAction = (
      props: Parameters<typeof LeadershipInviteDialog>[0],
    ) => createElement(LeadershipInviteDialog, { ...props, createInviteAction })

    render(
      createElement(LeadershipInviteDialogShell, {
        consentConfigured: true,
        leadershipId: 31,
        loadDialogModule: async () => ({ default: InviteDialogWithAction }),
        supportStatus: 'engajado',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Convidar pelo WhatsApp' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Criar convite' }))
    await screen.findByText('Convite pronto')

    expect(createInviteAction).toHaveBeenCalledWith({
      leadership: 31,
      kind: 'autopreenchimento',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(whatsappUrl))
    expect(await screen.findByRole('button', { name: 'Link copiado' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir WhatsApp' }))
    expect(open).toHaveBeenCalledWith(whatsappUrl, '_blank', 'noopener,noreferrer')
  })
})
