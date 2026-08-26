import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DemandWorkflowCard } from '@/components/campaign/demand/DemandWorkflowCard'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

/**
 * #921 glue regression net: the C139 manual dispatch builds FormData from the
 * form element only, so the pressed transition button (name="status",
 * value="aprovada"|…) never reaches `transitionDemandFormAction` and every
 * decision fails validation. The dispatch must include the submitter.
 */
describe('DemandWorkflowCard transition submit', () => {
  afterEach(cleanup)

  it('includes the pressed decision button (name=status) in the submitted FormData', () => {
    let captured: FormData | null = null
    const captureTransition = async (
      _state: CampaignFormActionState,
      formData: FormData,
    ): Promise<CampaignFormActionState> => {
      captured = formData
      return {}
    }

    render(
      <DemandWorkflowCard
        demandID={7}
        status="em_analise"
        canDecideEscalated={false}
        currentCost={null}
        transitionFormAction={captureTransition}
        costFormAction={async () => ({})}
        receiptFormAction={async () => ({})}
      />,
    )

    const approveButton = screen.getByRole('button', { name: 'Aprovar' })
    const form = approveButton.closest('form')
    expect(form).not.toBeNull()

    fireEvent.change(screen.getByLabelText('Nota da decisão'), {
      target: { value: 'Autorizado pelo assessor.' },
    })

    // A real SubmitEvent, not `fireEvent.submit`: testing-library maps submit
    // to a plain Event, which cannot carry the submitter this test pins.
    form!.dispatchEvent(
      new SubmitEvent('submit', {
        bubbles: true,
        cancelable: true,
        submitter: approveButton,
      }),
    )

    expect(captured).not.toBeNull()
    expect(captured!.get('status')).toBe('aprovada')
    expect(captured!.get('decisionNote')).toBe('Autorizado pelo assessor.')
    expect(captured!.get('demandId')).toBe('7')
  })

  it('submits the cost form with the cost button as submitter', () => {
    let captured: FormData | null = null
    const captureCost = async (
      _state: CampaignFormActionState,
      formData: FormData,
    ): Promise<CampaignFormActionState> => {
      captured = formData
      return {}
    }

    render(
      <DemandWorkflowCard
        demandID={7}
        status="em_analise"
        canDecideEscalated={false}
        currentCost={1200}
        transitionFormAction={async () => ({})}
        costFormAction={captureCost}
        receiptFormAction={async () => ({})}
      />,
    )

    const costButton = screen.getByRole('button', { name: 'Salvar custo' })
    const form = costButton.closest('form')
    expect(form).not.toBeNull()

    form!.dispatchEvent(
      new SubmitEvent('submit', {
        bubbles: true,
        cancelable: true,
        submitter: costButton,
      }),
    )

    expect(captured).not.toBeNull()
    expect(captured!.get('cost')).toBe('1200')
    expect(captured!.get('demandId')).toBe('7')
  })
})
