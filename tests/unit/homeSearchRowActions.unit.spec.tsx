import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { HomeSearchShareAction } from '@/components/campaign/dashboard/HomeSearchShareAction'
import { HomeSearchWhatsAppAction } from '@/components/campaign/dashboard/HomeSearchWhatsAppAction'

describe('HomeSearchWhatsAppAction', () => {
  it('renders WhatsApp link when phone normalizes', () => {
    render(<HomeSearchWhatsAppAction phone="71999998888" contactName="Maria Silva" />)

    const link = screen.getByRole('link', { name: 'Abrir no WhatsApp — Maria Silva' })
    expect(link.getAttribute('href')).toContain('https://wa.me/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('renders nothing when phone is invalid', () => {
    const { container } = render(<HomeSearchWhatsAppAction phone="123" contactName="Maria Silva" />)
    expect(container.firstChild).toBeNull()
  })
})

describe('HomeSearchShareAction', () => {
  it('opens WhatsApp fallback when native share is unavailable', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<HomeSearchShareAction title="Atividade X" detailPath="/campanha/atividades/x" />)

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar — Atividade X' }))

    expect(openSpy).toHaveBeenCalledOnce()
    expect(openSpy.mock.calls[0]?.[0]).toContain('https://wa.me/?text=')

    openSpy.mockRestore()
  })
})

describe('HomeSearchHitRow trailingAction', () => {
  it('keeps trailing action outside the row link', () => {
    const { container } = render(
      <HomeSearchHitRow
        href="/campanha/liderancas/1"
        primary="Maria Silva"
        trailingAction={<button type="button">Ação</button>}
      />,
    )

    const link = container.querySelector('a[href="/campanha/liderancas/1"]')
    const action = screen.getByRole('button', { name: 'Ação' })
    expect(link?.contains(action)).toBe(false)
  })
})
