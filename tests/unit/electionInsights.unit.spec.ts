// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { computeGapVs2022 } from '@/lib/electionInsights'
import type { NucleusElectoralBaselineViewModel } from '@/utilities/nucleusViewModels'

const baseline = (candidateVotes: number): NucleusElectoralBaselineViewModel => ({
  candidate: { votes: candidateVotes, rank: candidateVotes > 0 ? 1 : null },
  president: null,
  governor: null,
  electorate: { aptos: 0, validos: 0, brancos: 0, nulos: 0, abstencoes: 0 },
  winnerFederal: null,
})

describe('computeGapVs2022', () => {
  it('reports below when the estimate is under the 2022 patamar', () => {
    expect(computeGapVs2022(baseline(850), 500)).toEqual({
      gap: -350,
      ratio: 500 / 850,
      status: 'below',
      message: 'Faltam 350 votos para o patamar de 2022',
    })
  })

  it('reports above with the percent over 2022', () => {
    expect(computeGapVs2022(baseline(850), 952)).toMatchObject({
      gap: 102,
      status: 'above',
      message: 'Já superamos 2022 em 12%',
    })
  })

  it('reports noCandidateVotes when the geography had zero candidate votes in 2022', () => {
    expect(computeGapVs2022(baseline(0), 100)).toEqual({
      gap: null,
      ratio: null,
      status: 'noCandidateVotes',
      message: 'Jorge Solla não recebeu votos aqui em 2022 — território novo a abrir',
    })
  })

  it('reports noEstimate when confirmedVoteEstimate is null', () => {
    expect(computeGapVs2022(baseline(850), null)).toEqual({
      gap: null,
      ratio: null,
      status: 'noEstimate',
      message: 'Sem estimativa confirmada para comparar',
    })
  })

  it('reports noBaseline when geography is missing', () => {
    expect(computeGapVs2022(null, 100)).toEqual({
      gap: null,
      ratio: null,
      status: 'noBaseline',
      message: 'Sem baseline TSE (informe território/município)',
    })
  })
})
