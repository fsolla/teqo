// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  BA_2022_FEDERAL_PARTIES,
  normalizePartySigla,
  partySpectrum,
} from '@/lib/electionPartySpectrum'
import {
  aggregateTicketFlipOverview,
  aggregateTicketLeverageOverview,
  computeTicketFlipOpportunity,
  computeTicketLeverage,
  RIGHT_SHARE_THRESHOLD,
} from '@/lib/electionInsights'

describe('partySpectrum', () => {
  it('classifies left-wing parties from the 2022 survey', () => {
    expect(partySpectrum('PT')).toBe('esquerda')
    expect(partySpectrum('PSOL')).toBe('esquerda')
    expect(partySpectrum('PCdoB')).toBe('esquerda')
  })

  it('classifies right-wing parties from the 2022 survey', () => {
    expect(partySpectrum('PL')).toBe('direita')
    expect(partySpectrum('PSDB')).toBe('direita')
    expect(partySpectrum('MDB')).toBe('direita')
  })

  it('normalizes TSE aliases before lookup', () => {
    expect(normalizePartySigla('UNIAO')).toBe('UNIÃO')
    expect(partySpectrum('UNIAO')).toBe('direita')
    expect(partySpectrum('PC DO B')).toBe('esquerda')
  })

  it('returns null for unknown siglas', () => {
    expect(partySpectrum('PARTIDO NOVO DESCONHECIDO')).toBeNull()
  })

  it('covers parties present in the BA 2022 federal fixture', () => {
    for (const party of BA_2022_FEDERAL_PARTIES) {
      expect(partySpectrum(party)).not.toBeNull()
    }
  })
})

describe('computeTicketLeverage', () => {
  it('reports headline percent against the stronger majoritarian base', () => {
    const result = computeTicketLeverage({
      confirmedVoteEstimate: 500,
      presidentVotes: 1480,
      governorVotes: 1310,
    })
    expect(result.status).toBe('comparable')
    expect(result.headlinePercent).toBe(34)
    expect(result.message).toBe('Alavancagem da chapa: 34%')
    expect(result.supportLine).toContain('Da base Lula/Jerônimo ainda não convertida')
  })

  it('reports noEstimate without a confirmed estimate', () => {
    expect(
      computeTicketLeverage({
        confirmedVoteEstimate: null,
        presidentVotes: 1000,
        governorVotes: 900,
      }).status,
    ).toBe('noEstimate')
  })
})

describe('computeTicketFlipOpportunity', () => {
  const presidentLeft = { name: 'LULA', party: 'PT', votes: 8000 }
  const governorLeft = { name: 'JERÔNIMO', party: 'PT', votes: 6000 }

  it('fires on a right-wing federal winner when majoritarians align left', () => {
    const result = computeTicketFlipOpportunity({
      winnerPresident: presidentLeft,
      winnerGovernor: governorLeft,
      winnerFederal: { name: 'RIVAL', party: 'PL', votes: 2500 },
      federalVotesByParty: { PT: 2100, PL: 2500 },
    })
    expect(result.status).toBe('opportunity')
    expect(result.trigger).toBe('both')
    expect(result.majoritarianAlignment).toBe('both')
    expect(result.message).toContain('fora do campo')
    expect(result.message).not.toMatch(/direita/i)
  })

  it('fires on high right share even when the federal winner is left', () => {
    const result = computeTicketFlipOpportunity({
      winnerPresident: presidentLeft,
      winnerGovernor: null,
      winnerFederal: { name: 'SOLLA', party: 'PT', votes: 2100 },
      federalVotesByParty: { PT: 2100, PL: 900, PSDB: 500 },
    })
    expect(result.status).toBe('opportunity')
    expect(result.trigger).toBe('share')
    expect(result.majoritarianAlignment).toBe('president')
    expect(result.rightShare).toBeGreaterThanOrEqual(RIGHT_SHARE_THRESHOLD)
  })

  it('does not fire when right share is below the threshold and winner is left', () => {
    const result = computeTicketFlipOpportunity({
      winnerPresident: presidentLeft,
      winnerGovernor: governorLeft,
      winnerFederal: { name: 'SOLLA', party: 'PT', votes: 2100 },
      federalVotesByParty: { PT: 2100, PL: 100 },
    })
    expect(result.status).toBe('noOpportunity')
  })

  it('does not fire without left majoritarian alignment', () => {
    const result = computeTicketFlipOpportunity({
      winnerPresident: { name: 'BOLSONARO', party: 'PL', votes: 5000 },
      winnerGovernor: { name: 'RIVAL', party: 'PSDB', votes: 4500 },
      winnerFederal: { name: 'RIVAL', party: 'PL', votes: 1900 },
      federalVotesByParty: { PL: 1900, PT: 500 },
    })
    expect(result.status).toBe('incomplete')
  })

  it('fails closed on unknown party spectrum', () => {
    const result = computeTicketFlipOpportunity({
      winnerPresident: presidentLeft,
      winnerGovernor: governorLeft,
      winnerFederal: { name: 'SOLLA', party: 'PT', votes: 2100 },
      federalVotesByParty: { PT: 2100, 'SIGLA NOVA': 900 },
    })
    expect(result.status).toBe('unknownSpectrum')
  })
})

describe('overview aggregates', () => {
  it('computes weighted leverage and unconverted nuclei', () => {
    expect(
      aggregateTicketLeverageOverview([
        { estimate: 500, ticketVotes: 1000 },
        { estimate: 800, ticketVotes: 1000 },
      ]),
    ).toEqual({ weightedPercent: 65, unconvertedCount: 2 })
  })

  it('counts flip opportunities and both-aligned subset', () => {
    expect(
      aggregateTicketFlipOverview([
        {
          status: 'opportunity',
          trigger: 'winner',
          majoritarianAlignment: 'both',
          rightShare: 0.3,
          rightVotes: 300,
          totalFederalVotes: 1000,
          message: 'x',
          supportLine: null,
        },
        {
          status: 'opportunity',
          trigger: 'share',
          majoritarianAlignment: 'president',
          rightShare: 0.3,
          rightVotes: 300,
          totalFederalVotes: 1000,
          message: 'y',
          supportLine: null,
        },
        { status: 'noOpportunity', trigger: null, majoritarianAlignment: null, rightShare: null, rightVotes: 0, totalFederalVotes: 0, message: 'z', supportLine: null },
      ]),
    ).toEqual({ count: 2, bothAlignedCount: 1 })
  })
})
