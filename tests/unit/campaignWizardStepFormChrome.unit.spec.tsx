import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WizardStepFormChrome } from '@/components/campaign/shared/WizardStepFormChrome'

afterEach(() => cleanup())

describe('WizardStepFormChrome C140', () => {
  it('renders a <form> in action mode', () => {
    render(
      <WizardStepFormChrome
        action={vi.fn()}
        isPending={false}
        pendingAnnouncement="Salvando…"
        ctaLabel="Salvar"
      >
        <input type="text" name="title" defaultValue="abc" />
      </WizardStepFormChrome>,
    )

    const form = document.querySelector('form')
    expect(form).not.toBeNull()
    expect(form!.querySelector('input[name="title"]')).not.toBeNull()
  })

  it('renders a <div> in onCtaClick mode (not a form)', () => {
    render(
      <WizardStepFormChrome
        onCtaClick={vi.fn()}
        isPending={false}
        pendingAnnouncement="Salvando…"
        ctaLabel="Salvar"
      >
        Step content
      </WizardStepFormChrome>,
    )

    expect(document.querySelector('form')).toBeNull()
  })

  it('calls the action with FormData on submit, preserving uncontrolled field values', () => {
    const action = vi.fn().mockResolvedValue({})

    render(
      <WizardStepFormChrome
        action={action}
        isPending={false}
        pendingAnnouncement="Salvando…"
        ctaLabel="Salvar"
      >
        <input type="text" name="title" defaultValue="keep this" />
      </WizardStepFormChrome>,
    )

    const form = document.querySelector('form')!
    fireEvent.submit(form)

    expect(action).toHaveBeenCalledTimes(1)
    const formData = action.mock.calls[0][0] as FormData
    expect(formData.get('title')).toBe('keep this')
  })

  it('sets aria-busy and data-pending when isPending is true', () => {
    render(
      <WizardStepFormChrome
        action={vi.fn()}
        isPending={true}
        pendingAnnouncement="Salvando…"
        ctaLabel="Salvar"
      >
        Step
      </WizardStepFormChrome>,
    )

    const form = document.querySelector('form')!
    expect(form.getAttribute('aria-busy')).toBe('true')
    expect(form.hasAttribute('data-pending')).toBe(true)
    expect(screen.getAllByText('Salvando…').length).toBeGreaterThanOrEqual(1)
  })
})
