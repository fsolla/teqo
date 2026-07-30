import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { WIZARD_MUNICIPALITY_STEP_TITLE } from '@/lib/campaignWizardCopy'

describe('CampaignWizardShell', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders mobile back link with visible Voltar label', () => {
    const { container } = render(
      <CampaignWizardShell stepTitle={WIZARD_MUNICIPALITY_STEP_TITLE} previousHref="/campanha">
        Corpo
      </CampaignWizardShell>,
    )

    const back = screen.getByRole('link', { name: /Voltar/ })
    expect(back.getAttribute('href')).toBe('/campanha')
    const mobileBackSlot = container.querySelector('[data-slot="wizard-mobile-back"]')
    expect(mobileBackSlot?.contains(back)).toBe(true)
  })

  it('labels main landmark with the step title', () => {
    const { container } = render(
      <CampaignWizardShell stepTitle="Pergunta" previousHref="/campanha">
        Corpo
      </CampaignWizardShell>,
    )

    const main = within(container).getByRole('main')
    const heading = within(container).getByRole('heading', { level: 1, name: 'Pergunta' })
    expect(main.getAttribute('aria-labelledby')).toBe(heading.id)
  })

  it('moves focus to the step title when stepTitle changes', () => {
    const { rerender } = render(
      <CampaignWizardShell stepTitle="Passo 1" previousHref="/campanha">
        Corpo
      </CampaignWizardShell>,
    )

    rerender(
      <CampaignWizardShell stepTitle="Passo 2" previousHref="/campanha">
        Corpo
      </CampaignWizardShell>,
    )

    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Passo 2' }))
  })

  it('omits municipality caption when label is absent', () => {
    render(
      <CampaignWizardShell stepTitle="Pergunta" previousHref="/campanha">
        {null}
      </CampaignWizardShell>,
    )

    expect(screen.queryByLabelText(/Município em atualização/)).toBeNull()
  })

  it('shows municipality caption with accessible name', () => {
    render(
      <CampaignWizardShell
        stepTitle="Pergunta"
        previousHref="/campanha/acoes/atualizar-votos"
        municipalityLabel="Cairu"
      >
        {null}
      </CampaignWizardShell>,
    )

    const caption = screen.getByLabelText('Município em atualização: Cairu')
    expect(caption.textContent).toBe('Cairu')
  })
})
