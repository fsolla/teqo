import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { NucleusListOverview } from '@/components/campaign/NucleusListOverview'
import { buildNucleusListOverviewViewModel } from '@/utilities/nucleusListOverviewViewModels'

const now = new Date('2026-07-18T15:00:00.000Z')

const nucleus = ({
  id,
  coordinators = [],
  cities = ['Salvador'],
  regions = ['Metropolitano de Salvador'],
  tseZones = [1],
  confirmedVoteEstimate = null,
  proposedVoteEstimate = null,
  voteGoals = { good: null, regular: null, minimum: null },
  priority = 'normal' as const,
}: {
  id: number
  coordinators?: number[]
  cities?: string[]
  regions?: string[]
  tseZones?: number[]
  confirmedVoteEstimate?: number | null
  proposedVoteEstimate?: number | null
  voteGoals?: { good: number | null; regular: number | null; minimum: number | null }
  priority?: 'alta' | 'normal'
}) => ({
  id,
  slug: `nucleo-${id}`,
  name: `Núcleo ${id}`,
  coordinators,
  cities,
  regions,
  tseZones,
  confirmedVoteEstimate,
  proposedVoteEstimate,
  voteGoals,
  priority,
})

describe('buildNucleusListOverviewViewModel', () => {
  it('aggregates confirmed estimates, coverage, and pending suggestions for staff', () => {
    const view = buildNucleusListOverviewViewModel({
      role: 'geral',
      nuclei: [
        nucleus({ id: 1, coordinators: [10], confirmedVoteEstimate: 1000 }),
        nucleus({
          id: 2,
          coordinators: [11],
          confirmedVoteEstimate: 500,
          proposedVoteEstimate: 600,
        }),
        nucleus({ id: 3, proposedVoteEstimate: 200 }),
        nucleus({ id: 4 }),
      ],
      recentUpdates: [],
      upcomingActionPlans: [],
    })

    expect(view.totalFiltered).toBe(4)
    expect(view.estimate).toEqual({
      confirmedTotal: 1500,
      confirmedCount: 2,
      confirmedPercent: 50,
      unconfirmedCount: 2,
      pendingSuggestionsCount: 2,
    })
    expect(view.coverage).toEqual({
      coordinatedCount: 2,
      percent: 50,
    })
    expect(view.voteGoals).toEqual({ good: 0, regular: 0, minimum: 0 })
    expect(view.highPriorityCount).toBe(0)
  })

  it('omits pending suggestions for lideranca', () => {
    const view = buildNucleusListOverviewViewModel({
      role: 'lideranca',
      nuclei: [
        nucleus({ id: 1, coordinators: [10], confirmedVoteEstimate: 800 }),
        nucleus({ id: 2, proposedVoteEstimate: 400 }),
      ],
      recentUpdates: [],
      upcomingActionPlans: [],
    })

    expect(view.estimate).not.toHaveProperty('pendingSuggestionsCount')
    expect(view.estimate.confirmedTotal).toBe(800)
    expect(view.estimate.confirmedPercent).toBe(50)
  })

  it('aggregates vote goals and prioritários in the filtered set', () => {
    const view = buildNucleusListOverviewViewModel({
      role: 'geral',
      nuclei: [
        nucleus({
          id: 1,
          voteGoals: { good: 1000, regular: 800, minimum: 500 },
          priority: 'alta',
        }),
        nucleus({
          id: 2,
          voteGoals: { good: 200, regular: 150, minimum: 100 },
          priority: 'normal',
        }),
      ],
      recentUpdates: [],
      upcomingActionPlans: [],
    })

    expect(view.voteGoals).toEqual({ good: 1200, regular: 950, minimum: 600 })
    expect(view.highPriorityCount).toBe(1)
  })
})

describe('NucleusListOverview', () => {
  it('renders estimate, coverage, and update preview without a suggestions badge for lideranca', () => {
    const view = buildNucleusListOverviewViewModel({
      role: 'lideranca',
      nuclei: [
        nucleus({ id: 1, coordinators: [3], confirmedVoteEstimate: 1200 }),
        nucleus({ id: 2 }),
      ],
      recentUpdates: [
        {
          id: 21,
          nucleusSlug: 'nucleo-1',
          nucleusName: 'Núcleo 1',
          authorName: 'Maria',
          kind: 'semanal',
          createdAt: '2026-07-17T12:00:00.000Z',
        },
      ],
      upcomingActionPlans: [],
    })

    const html = renderToStaticMarkup(createElement(NucleusListOverview, { view, now }))

    expect(html).toContain('Mostrando agregados de')
    expect(html).toContain('1.200')
    expect(html).toContain('50% com estimativa confirmada')
    expect(html).toContain('1 de 2 com coordenador')
    expect(html).toContain('Metas 2026')
    expect(html).toContain('Últimas atualizações')
    expect(html).toContain('Maria')
    expect(html).toContain('Semanal')
    expect(html).toContain('/campanha/nucleos/nucleo-1?tab=updates')
    expect(html).not.toContain('sugestão pendente')
    expect(html).not.toContain('sugestões pendentes')
  })

  it('renders the pending suggestions badge for staff when proposals exist', () => {
    const view = buildNucleusListOverviewViewModel({
      role: 'geral',
      nuclei: [
        nucleus({ id: 1, proposedVoteEstimate: 300 }),
        nucleus({ id: 2, proposedVoteEstimate: 400 }),
      ],
      recentUpdates: [],
      upcomingActionPlans: [],
    })

    const html = renderToStaticMarkup(createElement(NucleusListOverview, { view, now }))

    expect(html).toContain('2 sugestões pendentes')
    expect(html).toContain('Nenhuma atualização recente')
  })

  it('renders the Baseline 2022 card when aggregate data is present', () => {
    const view = buildNucleusListOverviewViewModel({
      role: 'geral',
      nuclei: [nucleus({ id: 1, confirmedVoteEstimate: 1200 })],
      recentUpdates: [],
      upcomingActionPlans: [],
      baseline2022: { gapTotal: 2140, above: 8, below: 6 },
    })

    const html = renderToStaticMarkup(createElement(NucleusListOverview, { view, now }))

    expect(html).toContain('Baseline 2022')
    expect(html).toContain('+2.140')
    expect(html).toContain('8 acima')
    expect(html).toContain('6 abaixo')
  })

  it('hides the Baseline 2022 card when aggregate is null', () => {
    const view = buildNucleusListOverviewViewModel({
      role: 'lideranca',
      nuclei: [nucleus({ id: 1, cities: [], regions: [], tseZones: [] })],
      recentUpdates: [],
      upcomingActionPlans: [],
      baseline2022: null,
    })

    const html = renderToStaticMarkup(createElement(NucleusListOverview, { view, now }))

    expect(html).not.toContain('Baseline 2022')
  })

  it('renders the trend distribution card when aggregate data is present', () => {
    const view = buildNucleusListOverviewViewModel({
      role: 'geral',
      nuclei: [nucleus({ id: 1 })],
      recentUpdates: [],
      upcomingActionPlans: [],
      trend: { decline: 3, stable: 5, increase: 2, noBaseline: 1 },
    })

    const html = renderToStaticMarkup(createElement(NucleusListOverview, { view, now }))

    expect(html).toContain('Tendência histórica')
    expect(html).toContain('2 aumento')
    expect(html).toContain('5 mantém')
    expect(html).toContain('3 queda')
  })
})
