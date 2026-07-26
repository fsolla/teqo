import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const inviteActionState = vi.hoisted(() => ({
  createCampaignInvite: vi.fn(),
}))

vi.mock('@/app/(campaign)/campanha/actions/invite', () => ({
  createCampaignInvite: inviteActionState.createCampaignInvite,
}))

import { LeadershipInviteButtons } from '@/components/campaign/invite/LeadershipInviteButtons'
import { LeadershipInviteRowAction } from '@/components/campaign/invite/LeadershipInviteRowAction'

describe('campaign invite interactions', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    inviteActionState.createCampaignInvite.mockReset()
  })

  it('creates an autofill invite, links WhatsApp, and copies the invite URL', async () => {
    const inviteUrl = 'https://example.com/campanha/convite/secret'
    const whatsappUrl =
      'https://wa.me/5571999990000?text=Convite%20https%3A%2F%2Fexample.com%2Fcampanha%2Fconvite%2Fsecret'
    inviteActionState.createCampaignInvite.mockResolvedValue({ inviteUrl, whatsappUrl })
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      createElement(LeadershipInviteButtons, {
        leadershipID: 31,
        canInviteLogin: true,
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Convidar para completar cadastro' }))
    await screen.findByText(/Convite para completar cadastro gerado/)

    expect(inviteActionState.createCampaignInvite).toHaveBeenCalledWith({
      leadership: 31,
      kind: 'autopreenchimento',
    })

    const whatsappLink = screen.getByRole('link', { name: 'Enviar pelo WhatsApp' })
    expect(whatsappLink.getAttribute('href')).toBe(whatsappUrl)
    expect(whatsappLink.getAttribute('target')).toBe('_blank')
    expect(whatsappLink.getAttribute('rel')).toBe('noopener noreferrer')

    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(inviteUrl))
    expect(await screen.findByRole('button', { name: 'Link copiado' })).toBeTruthy()
  })

  it('hides the login invite button when the leadership is not engaged', () => {
    render(
      createElement(LeadershipInviteButtons, {
        leadershipID: 31,
        canInviteLogin: false,
      }),
    )

    expect(screen.queryByRole('button', { name: 'Convidar para o app' })).toBeNull()
  })

  it('shows the fail-closed consent message when the consent key is missing', async () => {
    inviteActionState.createCampaignInvite.mockRejectedValue(
      new Error('Consentimento ainda não configurado.'),
    )

    render(
      createElement(LeadershipInviteButtons, {
        leadershipID: 31,
        canInviteLogin: true,
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Convidar para o app' }))

    expect(
      await screen.findByText(/Consentimento ainda não configurado — peça a um admin/),
    ).toBeTruthy()
    expect(inviteActionState.createCampaignInvite).toHaveBeenCalledWith({
      leadership: 31,
      kind: 'login',
    })
  })

  it('disables the list-row invite trigger when the phone is missing or invalid', () => {
    render(
      createElement(LeadershipInviteRowAction, {
        leadershipID: 9,
        name: 'Ana Silva',
        hasValidPhone: false,
      }),
    )

    const trigger = screen.getByRole('button', {
      name: 'Sem celular cadastrado — Ana Silva',
    })
    expect((trigger as HTMLButtonElement).disabled).toBe(true)
  })

  it('generates an autofill invite from the list-row popover', async () => {
    const inviteUrl = 'https://example.com/campanha/convite/list-row'
    const whatsappUrl = 'https://wa.me/5571999990000?text=Convite'
    inviteActionState.createCampaignInvite.mockResolvedValue({ inviteUrl, whatsappUrl })

    render(
      createElement(LeadershipInviteRowAction, {
        leadershipID: 42,
        name: 'João Souza',
        hasValidPhone: true,
      }),
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Convidar João Souza para completar cadastro por WhatsApp',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Gerar convite' }))

    await screen.findByText(/Convite para completar cadastro gerado/)
    expect(inviteActionState.createCampaignInvite).toHaveBeenCalledWith({
      leadership: 42,
      kind: 'autopreenchimento',
    })
    expect(screen.getByRole('link', { name: 'Enviar pelo WhatsApp' }).getAttribute('href')).toBe(
      whatsappUrl,
    )
  })
})
