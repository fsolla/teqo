import { cleanup, render, screen } from '@testing-library/react'
import { CalendarDays } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CampaignPageChromeText } from '@/components/campaign/shell/CampaignPageChromeText'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CampaignPageChromeText (mobile)', () => {
  it('renderiza o título como botão quando há onTitleClick', () => {
    const action = vi.fn()
    render(
      <CampaignPageChromeText
        layout="mobile"
        chrome={{ title: '9 Agosto', onTitleClick: { action, hint: 'Voltar para hoje' } }}
      />,
    )
    const button = screen.getByRole('button', { name: '9 Agosto' })
    button.click()
    expect(action).toHaveBeenCalled()
    // Sem `icon` no contrato, o botão não renderiza glyph nenhum.
    expect(button.querySelector('svg')).toBeNull()
  })

  it('renderiza o glyph do affordance (aria-hidden) quando onTitleClick.icon existe', () => {
    render(
      <CampaignPageChromeText
        layout="mobile"
        chrome={{
          title: '9 Agosto',
          onTitleClick: { action: vi.fn(), hint: 'Voltar para hoje', icon: CalendarDays },
        }}
      />,
    )
    const button = screen.getByRole('button', { name: '9 Agosto' })
    const icon = button.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
  })

  it('não renderiza glyph sem icon no contrato', () => {
    render(<CampaignPageChromeText layout="mobile" chrome={{ title: 'Agenda' }} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Agenda')).toBeTruthy()
  })
})

describe('CampaignPageChromeText (desktop)', () => {
  it('não vira botão nem renderiza glyph — o chrome do desktop é texto', () => {
    render(
      <CampaignPageChromeText
        layout="desktop"
        chrome={{
          title: '9 Agosto',
          onTitleClick: { action: vi.fn(), hint: 'Voltar para hoje', icon: CalendarDays },
        }}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('9 Agosto')).toBeTruthy()
  })
})
