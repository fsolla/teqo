import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { MunicipalitySliceTotalsLine } from '@/components/campaign/municipality/MunicipalitySliceTotalsLine'
import type { MunicipalitySliceTotals } from '@/lib/municipalitySliceTotals'
import type { VoteEstimateScenario } from '@/lib/voteEstimate'

const scenarioState = { scenario: 'central' as VoteEstimateScenario }

vi.mock('@/components/campaign/municipality/MunicipalityEstimateScenarioContext', () => ({
  useMunicipalityEstimateScenarioOptional: () => ({
    scenario: scenarioState.scenario,
    setScenario: () => {},
  }),
}))

const render = (totals: MunicipalitySliceTotals): string =>
  renderToStaticMarkup(createElement(MunicipalitySliceTotalsLine, { totals }))

describe('MunicipalitySliceTotalsLine', () => {
  it('formats the four sums and reads the full scenario summary to screen readers', () => {
    const html = render({
      rowCount: 3,
      votes2022: 1_234,
      expectedByScenario: { pessimistic: 100, central: null, optimistic: 0 },
      withEstimateCount: 1,
    })

    expect(html).toContain('data-slot="municipality-slice-totals"')
    expect(html).toContain('1.234')
    expect(html).toContain('Pess.')
    expect(html).toContain('100')
    expect(html).toContain('Média')
    expect(html).toContain('—')
    expect(html).toContain('Otim.')
    expect(html).toContain('1 de 3 com expectativa')
    expect(html).toContain(
      'Pessimista: 100; Média: não informado; Otimista: 0; 1 de 3 com expectativa',
    )
    expect(html).not.toContain('aria-label=')
  })

  it('omits the coverage sentence and keeps the scenario dashes when nobody filled one', () => {
    const html = render({
      rowCount: 2,
      votes2022: 0,
      expectedByScenario: { pessimistic: null, central: null, optimistic: null },
      withEstimateCount: 0,
    })

    expect(html).not.toContain('com expectativa')
    expect(html).toContain(
      'Pessimista: não informado; Média: não informado; Otimista: não informado',
    )
  })

  it('emphasizes only the active scenario', () => {
    scenarioState.scenario = 'optimistic'
    const html = render({
      rowCount: 1,
      votes2022: 0,
      expectedByScenario: { pessimistic: 100, central: 200, optimistic: 300 },
      withEstimateCount: 1,
    })
    scenarioState.scenario = 'central'

    expect(html).toContain('text-foreground font-semibold">300')
    expect(html).not.toContain('text-foreground font-semibold">200')
    expect(html).toContain('text-foreground">200')
  })
})
