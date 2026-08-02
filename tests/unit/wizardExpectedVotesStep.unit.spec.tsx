import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WizardExpectedVotesStep } from '@/components/campaign/shared/WizardExpectedVotesStep'
import { CampaignWizardChromeProvider } from '@/components/campaign/shell/CampaignWizardChromeContext'
import { CAMPAIGN_ACTIONS_HOME } from '@/lib/campaignActionRoutes'
import { postCampaignJson } from '@/lib/campaignJsonRequest'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
  }),
}))

vi.mock('@/lib/campaignJsonRequest', () => ({
  postCampaignJson: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

const defaultProps = {
  actionSlug: 'atualizar-votos',
  municipalityId: 1,
  municipalityName: 'Cairu',
  municipalitySlug: 'cairu',
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
    pushMock.mockReset()
  })

  it('applies shortcuts to the focused scenario', () => {
    renderVotesStep({ ...defaultProps })

    fireEvent.focus(screen.getByLabelText('Pessimista'))
    fireEvent.click(screen.getByRole('button', { name: '2×' }))

    expect((screen.getByLabelText('Pessimista') as HTMLInputElement).value).toBe('200')
    expect((screen.getByLabelText('Média') as HTMLInputElement).value).toBe('200')
  })

  it('highlights the last focused scenario in compact inputs', () => {
    renderVotesStep({ ...defaultProps })

    const central = screen.getByLabelText('Média')
    const optimistic = screen.getByLabelText('Otimista')

    expect(central.className).toMatch(/border-primary/)
    expect(optimistic.className).toMatch(/bg-muted/)

    fireEvent.focus(optimistic)

    expect(central.className).toMatch(/bg-muted/)
    expect(optimistic.className).toMatch(/border-primary/)
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

  it('posts batch expected votes and continues the wizard chain', async () => {
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
      expect(pushMock).toHaveBeenCalledWith(
        `${CAMPAIGN_ACTIONS_HOME}/mudar-tendencia?municipio=cairu&entry=update-votes`,
      )
    })
  })

  it('shows skip to the next chain step when votes is chained', () => {
    renderVotesStep({ ...defaultProps, entryAction: 'register-signal' })

    const skip = screen.getByRole('link', { name: /^Pular$/i })
    expect(skip.getAttribute('href')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/atualizar-lideranca?municipio=cairu&entry=register-signal`,
    )
  })
})
