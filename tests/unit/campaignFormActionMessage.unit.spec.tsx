import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'

/**
 * P3-G pin: the primitive owns the live region — 10 of 15 hand-spelled
 * feedback blocks were mute for assistive tech, so both variants MUST render
 * inside an `aria-live` region (the a11y assertion the plan asks for).
 */
describe('CampaignFormActionMessage (P3-G)', () => {
  it('announces errors inside a live region with the optional title', () => {
    const { container } = render(
      <CampaignFormActionMessage
        state={{ status: 'error', message: 'Verifique os dados.' }}
        errorTitle="Não foi possível salvar"
      />,
    )

    expect(screen.getByText('Verifique os dados.')).toBeTruthy()
    expect(screen.getByText('Não foi possível salvar')).toBeTruthy()
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
  })

  it('announces success with the fallback message, and renders nothing when mute', () => {
    const { container, rerender } = render(
      <CampaignFormActionMessage
        state={{ status: 'success' }}
        successFallbackMessage="Registro salvo."
      />,
    )
    expect(screen.getByText('Registro salvo.')).toBeTruthy()
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()

    rerender(<CampaignFormActionMessage state={{}} />)
    expect(container.querySelector('[aria-live="polite"]')).toBeNull()
  })
})
