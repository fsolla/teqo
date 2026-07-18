import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ShareNucleusDialog, buildNucleusShareMessage } from '@/components/campaign/ShareNucleusDialog'
import { ShareNucleusDialogShell } from '@/components/campaign/ShareNucleusDialogShell'
import type { NucleusShareRecipients } from '@/utilities/nucleusShareRecipients'

class TestResizeObserver {
  observe = () => undefined
  unobserve = () => undefined
  disconnect = () => undefined
}

globalThis.ResizeObserver ??= TestResizeObserver

const recipientsFixture = (): NucleusShareRecipients => ({
  general: [{ id: 1, name: 'Carlos Mendes', phone: '71999990001' }],
  coordinators: [{ id: 2, name: 'João Santos', phone: '71999990002' }],
  leaderships: [{ id: 3, name: 'Dona Rosa Ferreira', phone: '71999990003' }],
})

describe('campaign nucleus share interactions', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('builds the fixed WhatsApp message template', () => {
    expect(
      buildNucleusShareMessage({
        recipientName: 'Carlos Mendes',
        senderName: 'Ana',
        nucleusName: 'Quilombo Rio das Rãs',
        nucleusUrl: 'https://example.com/campanha/nucleos/quilombo-rio-das-ras',
      }),
    ).toBe(
      'Oi Carlos Mendes, aqui é Ana da campanha do Solla. Veja o núcleo Quilombo Rio das Rãs: https://example.com/campanha/nucleos/quilombo-rio-das-ras',
    )
  })

  it('loads recipients on open, copies the nucleus link, and opens WhatsApp', async () => {
    const nucleusUrl = 'https://example.com/campanha/nucleos/quilombo-rio-das-ras'
    const loadRecipients = vi.fn(async () => ({
      recipients: recipientsFixture(),
      nucleusUrl,
    }))
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)

    const ShareDialogWithProps = (
      props: Parameters<typeof ShareNucleusDialog>[0],
    ) => createElement(ShareNucleusDialog, props)

    render(
      createElement(ShareNucleusDialogShell, {
        loadDialogModule: async () => ({ default: ShareDialogWithProps }),
        loadRecipients,
        nucleusName: 'Quilombo Rio das Rãs',
        senderName: 'Ana Ribeiro',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
    expect(await screen.findByText('Compartilhar núcleo')).toBeTruthy()
    await waitFor(() => expect(loadRecipients).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Carlos Mendes')).toBeTruthy()
    expect(screen.getByText('João Santos')).toBeTruthy()
    expect(screen.getByText('Dona Rosa Ferreira')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(nucleusUrl))
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir' })[0]!)
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/5571999990001?text='),
      '_blank',
      'noopener,noreferrer',
    )
    const openedUrl = new URL(String(open.mock.calls[0]?.[0]))
    const message = openedUrl.searchParams.get('text') ?? ''
    expect(message).toContain('Oi Carlos Mendes, aqui é Ana Ribeiro')
    expect(message).toContain(nucleusUrl)
  })

  it('hides empty recipient sections', async () => {
    const loadRecipients = vi.fn(async () => ({
      recipients: {
        general: [],
        coordinators: [],
        leaderships: [],
      },
      nucleusUrl: 'https://example.com/campanha/nucleos/nucleo-vazio',
    }))

    render(
      createElement(ShareNucleusDialogShell, {
        loadDialogModule: async () => ({ default: ShareNucleusDialog }),
        loadRecipients,
        nucleusName: 'Núcleo Vazio',
        senderName: 'Coord',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
    await screen.findByText('Copiar link')
    expect(screen.queryByText('Com coordenação geral')).toBeNull()
    expect(screen.queryByText('Com coordenador')).toBeNull()
    expect(screen.queryByText('Com liderança')).toBeNull()
  })
})
