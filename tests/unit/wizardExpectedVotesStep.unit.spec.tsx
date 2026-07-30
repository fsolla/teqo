import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WizardExpectedVotesStep } from '@/components/campaign/shared/WizardExpectedVotesStep'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/campaignJsonRequest', () => ({
  postCampaignJson: vi.fn(),
}))

const defaultProps = {
  actionSlug: 'atualizar-votos',
  municipalityId: 1,
  municipalityName: 'Cairu',
  municipalitySlug: 'cairu',
  initialExpectedVotes: { pessimistic: 100, central: 200, optimistic: 300 },
}

describe('WizardExpectedVotesStep', () => {
  afterEach(() => {
    cleanup()
    replace.mockClear()
  })

  it('shows violation banner on média immediately after pessimista breaks order', () => {
    const { rerender } = render(
      <WizardExpectedVotesStep {...defaultProps} currentScenario="pessimistic" />,
    )

    fireEvent.change(screen.getByLabelText(/Pessimista em Cairu/i), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar estimativa pessimista →' }))

    expect(replace).toHaveBeenCalledWith(expect.stringContaining('cenario=central'))

    rerender(<WizardExpectedVotesStep {...defaultProps} currentScenario="central" />)

    const step = screen.getByRole('main', { name: /Qual a nova estimativa média/i })
    expect(within(step).getByRole('alert').textContent).toMatch(/Pessimista/i)
    expect(within(step).getByRole('button', { name: /Voltar para pessimista/i })).toBeTruthy()
  })

  it('clears violation banner when média draft is edited', () => {
    const { rerender } = render(
      <WizardExpectedVotesStep {...defaultProps} currentScenario="pessimistic" />,
    )

    fireEvent.change(screen.getByLabelText(/Pessimista em Cairu/i), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar estimativa pessimista →' }))
    rerender(<WizardExpectedVotesStep {...defaultProps} currentScenario="central" />)

    const step = screen.getByRole('main', { name: /Qual a nova estimativa média/i })
    expect(within(step).getByRole('alert')).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/Média em Cairu/i), { target: { value: '250' } })
    expect(within(step).queryByRole('alert')).toBeNull()
  })
})
