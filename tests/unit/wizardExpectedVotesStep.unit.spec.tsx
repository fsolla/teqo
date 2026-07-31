import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WizardExpectedVotesStep } from '@/components/campaign/shared/WizardExpectedVotesStep'
import { CampaignWizardChromeProvider } from '@/components/campaign/shell/CampaignWizardChromeContext'
import { postCampaignJson } from '@/lib/campaignJsonRequest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

vi.mock('@/lib/campaignJsonRequest', () => ({
  postCampaignJson: vi.fn(),
}))

const defaultProps = {
  actionSlug: 'atualizar-votos',
  municipalityId: 1,
  municipalityName: 'Cairu',
  initialExpectedVotes: { pessimistic: 100, central: 200, optimistic: 300 },
}

const renderVotesStep = (props: React.ComponentProps<typeof WizardExpectedVotesStep>) =>
  render(
    <CampaignWizardChromeProvider>
      <WizardExpectedVotesStep {...props} />
    </CampaignWizardChromeProvider>,
  )

describe('WizardExpectedVotesStep', () => {
  afterEach(() => {
    cleanup()
    vi.mocked(postCampaignJson).mockReset()
  })

  it('applies shortcuts to the focused scenario', () => {
    renderVotesStep({ ...defaultProps })

    fireEvent.focus(screen.getByLabelText('Pessimista'))
    fireEvent.click(screen.getByRole('button', { name: '2×' }))

    expect((screen.getByLabelText('Pessimista') as HTMLInputElement).value).toBe('200')
    expect((screen.getByLabelText('Média') as HTMLInputElement).value).toBe('200')
  })

  it('shows violation alert and highlights inputs without navigation', () => {
    renderVotesStep({ ...defaultProps })

    fireEvent.change(screen.getByLabelText('Pessimista'), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar estimativas →' }))

    const step = screen.getByRole('main', { name: /Ajustar votos estimados/i })
    expect(within(step).getByRole('alert').textContent).toMatch(/Pessimista/i)
    expect(screen.getByLabelText('Pessimista').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Média').getAttribute('aria-invalid')).toBe('true')
  })

  it('clears violation when a draft is edited', () => {
    renderVotesStep({ ...defaultProps })

    fireEvent.change(screen.getByLabelText('Pessimista'), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar estimativas →' }))

    const step = screen.getByRole('main', { name: /Ajustar votos estimados/i })
    expect(within(step).getByRole('alert')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Média'), { target: { value: '950' } })
    expect(within(step).queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('Pessimista').getAttribute('aria-invalid')).toBeNull()
  })

  it('posts batch expected votes when estimates are coherent', async () => {
    vi.mocked(postCampaignJson).mockResolvedValue({
      ok: true,
      payload: {
        status: 'success',
        savedExpectedVotes: { pessimistic: 150, central: 250, optimistic: 350 },
      },
    })

    renderVotesStep({ ...defaultProps })

    fireEvent.change(screen.getByLabelText('Pessimista'), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('Média'), { target: { value: '250' } })
    fireEvent.change(screen.getByLabelText('Otimista'), { target: { value: '350' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar estimativas →' }))

    await waitFor(() => {
      expect(postCampaignJson).toHaveBeenCalledWith('/campanha/municipios/expected-votes', {
        municipalityId: 1,
        expectedVotes: { pessimistic: 150, central: 250, optimistic: 350 },
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/Votos estimados atualizados/i)
    })
  })
})
