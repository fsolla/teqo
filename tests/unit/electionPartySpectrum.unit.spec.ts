// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  BA_2022_FEDERAL_PARTIES,
  normalizePartySigla,
  partySpectrum,
} from '@/lib/electionPartySpectrum'

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
