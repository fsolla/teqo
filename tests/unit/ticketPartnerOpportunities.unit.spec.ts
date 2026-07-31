// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  computeTicketPartnerOpportunities,
  isTicketPartnerOffice,
  TICKET_PARTNER_LIST_LIMIT,
  ticketPartnerTierForParty,
  type TicketPartnerInput,
} from '@/lib/ticketPartnerOpportunities'

const candidate = (overrides: Partial<TicketPartnerInput>): TicketPartnerInput => ({
  office: 'deputado_federal',
  candidateNumber: 9001,
  name: 'Candidato Teste',
  party: 'PT',
  elected2022: false,
  votes2022: 0,
  ...overrides,
})

describe('ticketPartnerTierForParty', () => {
  it('marks the curated 2026 field (FE Brasil) as aliado', () => {
    expect(ticketPartnerTierForParty('PT')).toBe('aliado')
    expect(ticketPartnerTierForParty('PV')).toBe('aliado')
    expect(ticketPartnerTierForParty('PC do B')).toBe('aliado')
  })

  it('marks esquerda-spectrum parties outside the field as aliadoHistorico', () => {
    expect(ticketPartnerTierForParty('PSOL')).toBe('aliadoHistorico')
    expect(ticketPartnerTierForParty('PDT')).toBe('aliadoHistorico')
    expect(ticketPartnerTierForParty('PSB')).toBe('aliadoHistorico')
  })

  it('marks the centro bucket as neutro', () => {
    // AVANTE (4,8) is the one 2022 centro-bucket entry in the survey means.
    expect(ticketPartnerTierForParty('AVANTE')).toBe('neutro')
  })

  it('marks the direita bucket as adversario', () => {
    expect(ticketPartnerTierForParty('PL')).toBe('adversario')
    expect(ticketPartnerTierForParty('MDB')).toBe('adversario')
    expect(ticketPartnerTierForParty('UNIÃO')).toBe('adversario')
  })

  it('fails to the middle on unknown or missing parties — never inventing trust or hostility', () => {
    expect(ticketPartnerTierForParty('SIGLA INEXISTENTE')).toBe('neutro')
    expect(ticketPartnerTierForParty(null)).toBe('neutro')
    expect(ticketPartnerTierForParty(undefined)).toBe('neutro')
    expect(ticketPartnerTierForParty('')).toBe('neutro')
  })
})

describe('isTicketPartnerOffice', () => {
  it('accepts only the proportional offices', () => {
    expect(isTicketPartnerOffice('deputado_federal')).toBe(true)
    expect(isTicketPartnerOffice('deputado_estadual')).toBe(true)
    expect(isTicketPartnerOffice('presidente')).toBe(false)
    expect(isTicketPartnerOffice('governador')).toBe(false)
  })
})

describe('computeTicketPartnerOpportunities', () => {
  it('scores alignment over force: a small-vote aliado beats a strong-vote neutro', () => {
    const [first, second] = computeTicketPartnerOpportunities([
      candidate({ name: 'Neutro Forte', party: 'AVANTE', votes2022: 1000 }),
      candidate({ name: 'Aliado Fraco', party: 'PT', votes2022: 100 }),
    ])
    // aliado: 0.6*1 + 0.4*0.1 = 0.64 · neutro: 0.6*0.35 + 0.4*1 = 0.61
    expect(first?.name).toBe('Aliado Fraco')
    expect(first?.score).toBe(0.64)
    expect(second?.name).toBe('Neutro Forte')
    expect(second?.score).toBe(0.61)
  })

  it('normalizes votes by the strongest candidate inside the municipality set', () => {
    const [first, second] = computeTicketPartnerOpportunities([
      candidate({ name: 'A', party: 'PT', votes2022: 2000 }),
      candidate({ name: 'B', party: 'PV', votes2022: 500 }),
    ])
    expect(first?.score).toBe(1) // 0.6 + 0.4*1
    expect(second?.score).toBe(0.7) // 0.6 + 0.4*0.25
  })

  it('breaks score ties on raw votes, then on name', () => {
    const ordered = computeTicketPartnerOpportunities([
      candidate({ name: 'Zuleica', party: 'PSOL', votes2022: 300 }),
      candidate({ name: 'Ana', party: 'PSOL', votes2022: 300 }),
      candidate({ name: 'Beto', party: 'PSOL', votes2022: 900 }),
    ])
    expect(ordered.map((opportunity) => opportunity.name)).toEqual(['Beto', 'Ana', 'Zuleica'])
  })

  it('sinks an adversary below equally-strong allies, and breaks cross-tier ties on votes', () => {
    const sameVotes = computeTicketPartnerOpportunities([
      candidate({ name: 'Adversário', party: 'PL', votes2022: 1000 }),
      candidate({ name: 'Aliado', party: 'PT', votes2022: 1000 }),
      candidate({ name: 'Histórico', party: 'PSOL', votes2022: 1000 }),
    ])
    expect(sameVotes.map((opportunity) => opportunity.tier)).toEqual([
      'aliado',
      'aliadoHistorico',
      'adversario',
    ])

    // A much stronger adversary TIES with a weak historic ally (0.46 = 0.46)
    // and wins the vote tie-break: the badge, not the rank, carries the warning.
    const mixed = computeTicketPartnerOpportunities([
      candidate({ name: 'Adversário Forte', party: 'PL', votes2022: 5000 }),
      candidate({ name: 'Aliado', party: 'PT', votes2022: 1000 }),
      candidate({ name: 'Histórico Fraco', party: 'PSOL', votes2022: 500 }),
    ])
    expect(mixed.map((opportunity) => [opportunity.name, opportunity.score])).toEqual([
      ['Aliado', 0.68],
      ['Adversário Forte', 0.46],
      ['Histórico Fraco', 0.46],
    ])
  })

  it('handles an all-zero-vote set without NaN scores', () => {
    const [only] = computeTicketPartnerOpportunities([
      candidate({ name: 'Sem Votos', party: 'PT', votes2022: 0 }),
    ])
    expect(only?.score).toBe(0.6)
    expect(Number.isNaN(only?.score)).toBe(false)
  })

  it('caps the list at the configured limit', () => {
    const candidates = Array.from({ length: TICKET_PARTNER_LIST_LIMIT + 2 }, (_, index) =>
      candidate({ name: `Candidato ${index}`, candidateNumber: 9000 + index, votes2022: index }),
    )
    expect(computeTicketPartnerOpportunities(candidates)).toHaveLength(TICKET_PARTNER_LIST_LIMIT)
  })

  it('returns an empty list for an empty set', () => {
    expect(computeTicketPartnerOpportunities([])).toEqual([])
  })
})
