import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { NucleusElectoralBaseline } from '@/components/campaign/NucleusElectoralBaseline'
import { NucleusInsights } from '@/components/campaign/NucleusInsights'
import { computeTicketFlipOpportunity } from '@/lib/electionInsights'
import type { NucleusElectoralBaselineViewModel } from '@/utilities/nucleusViewModels'

const baseline: NucleusElectoralBaselineViewModel = {
  candidate: { votes: 850, rank: 2 },
  president: { votes: 1480, turn: 2 },
  governor: { votes: 1310, turn: 2 },
  electorate: {
    aptos: 4700,
    validos: 2490,
    brancos: 142,
    nulos: 87,
    abstencoes: 680,
  },
  winnerFederal: { name: 'Dep. Fulano de Tal', votes: 2100, party: 'PP' },
  winnerPresident: { name: 'LULA', party: 'PT', votes: 8000 },
  winnerGovernor: { name: 'JERÔNIMO', party: 'PT', votes: 6000 },
  federalVotesByParty: { PT: 850, PP: 2100 },
  ticketFlip: computeTicketFlipOpportunity({
    winnerPresident: { name: 'LULA', party: 'PT', votes: 8000 },
    winnerGovernor: { name: 'JERÔNIMO', party: 'PT', votes: 6000 },
    winnerFederal: { name: 'Dep. Fulano de Tal', votes: 2100, party: 'PP' },
    federalVotesByParty: { PT: 850, PP: 2100 },
  }),
  series: { y2014: 700, y2018: 800, y2022: 850 },
}

describe('NucleusElectoralBaseline', () => {
  it('renders the empty geography state', () => {
    const html = renderToStaticMarkup(createElement(NucleusElectoralBaseline, { baseline: null }))
    expect(html).toContain('Baseline eleitoral 2022')
    expect(html).toContain('Sem baseline TSE (informe território/município)')
  })

  it('renders the candidate, ticket, electorate, and local winner rows', () => {
    const html = renderToStaticMarkup(createElement(NucleusElectoralBaseline, { baseline }))
    expect(html).toContain('Jorge Solla')
    expect(html).toContain('850')
    expect(html).toContain('Lula')
    expect(html).toContain('1.480')
    expect(html).toContain('Jerônimo Rodrigues')
    expect(html).toContain('Eleitorado 2022')
    expect(html).toContain('2.490')
    expect(html).toContain('Mais votado aqui em 2022')
    expect(html).toContain('Dep. Fulano de Tal (PP)')
    expect(html).toContain('Série histórica')
    expect(html).toContain('2014: 700')
  })
})

describe('NucleusInsights', () => {
  it('renders the amber below alert for Gap vs 2022', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusInsights, {
        baseline,
        confirmedVoteEstimate: 500,
      }),
    )
    expect(html).toContain('data-insight="gap-vs-2022"')
    expect(html).toContain('Faltam 350 votos para o patamar de 2022')
    expect(html).toContain('Estimativa atual (500)')
  })

  it('renders the green above alert when the estimate clears 2022', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusInsights, {
        baseline,
        confirmedVoteEstimate: 952,
      }),
    )
    expect(html).toContain('Já superamos 2022 em 12%')
  })

  it('renders the vote-trend insight when the series is comparable', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusInsights, {
        baseline,
        confirmedVoteEstimate: 500,
      }),
    )
    expect(html).toContain('data-insight="vote-trend"')
    expect(html).toContain('Tendência:')
  })

  it('renders ticket leverage, flip opportunity, and territorial classification insights', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusInsights, {
        baseline,
        confirmedVoteEstimate: 500,
      }),
    )
    expect(html).toContain('data-insight="ticket-leverage"')
    expect(html).toContain('Alavancagem da chapa:')
    expect(html).toContain('data-insight="ticket-flip"')
    expect(html).toContain('completar a chapa')
    expect(html).not.toMatch(/direita/i)
    expect(html).toContain('data-insight="territorial-class"')
    expect(html).toContain('Território indeciso')
    expect(html).toContain('Pulverizado — prioridade: consolidar')
    expect(html).toContain('Indecisa')
    expect(html).toContain('34% dos votos válidos federais em 2022')
  })
})
