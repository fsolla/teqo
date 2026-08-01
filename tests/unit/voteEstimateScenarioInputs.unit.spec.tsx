import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VoteEstimateScenarioInputs } from '@/components/campaign/votePledge/VoteEstimateScenarioInputs'

const defaultValues = { pessimistic: 80, central: 100, optimistic: 120 }

const renderCompact = (
  props: Partial<React.ComponentProps<typeof VoteEstimateScenarioInputs>> = {},
) =>
  render(
    <VoteEstimateScenarioInputs
      fieldPrefix="expectedVotes"
      values={defaultValues}
      idPrefix="test-votes"
      variant="compact"
      activeScenario="central"
      onValuesChange={vi.fn()}
      {...props}
    />,
  )

describe('VoteEstimateScenarioInputs compact', () => {
  afterEach(() => {
    cleanup()
  })

  it('highlights the active scenario instead of always central', () => {
    const { rerender } = renderCompact({ activeScenario: 'central' })

    const central = screen.getByLabelText('Média')
    const optimistic = screen.getByLabelText('Otimista')

    expect(central.className).toMatch(/border-primary/)
    expect(optimistic.className).toMatch(/bg-muted/)

    rerender(
      <VoteEstimateScenarioInputs
        fieldPrefix="expectedVotes"
        values={defaultValues}
        idPrefix="test-votes"
        variant="compact"
        activeScenario="optimistic"
        onValuesChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Média').className).toMatch(/bg-muted/)
    expect(screen.getByLabelText('Otimista').className).toMatch(/border-primary/)
  })

  it('keeps destructive styling ahead of active highlight', () => {
    renderCompact({
      activeScenario: 'optimistic',
      errorScenarios: new Set(['optimistic']),
    })

    const optimistic = screen.getByLabelText('Otimista')
    expect(optimistic.className).toMatch(/border-destructive/)
    expect(optimistic.className).not.toMatch(/border-primary/)
    expect(optimistic.getAttribute('aria-invalid')).toBe('true')
  })

  it('updates active scenario on focus', () => {
    const onFocusScenario = vi.fn()
    renderCompact({ onFocusScenario })

    fireEvent.focus(screen.getByLabelText('Pessimista'))
    expect(onFocusScenario).toHaveBeenCalledWith('pessimistic')
  })
})
