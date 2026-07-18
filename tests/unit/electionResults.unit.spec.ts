// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { bahiaMunicipalities } from '@/lib/bahiaTerritories'
import { computeIdentityKey, normalizeIdentityPart } from '@/lib/electionCandidateIdentity'
import {
  assertAllCanonicalMunicipalitiesResolvable,
  canonicalizeMunicipalityName,
  computeWinnersByScope,
  JERONIMO_CANDIDATE_NUMBER,
  LULA_CANDIDATE_NUMBER,
  mergeTallyWithWinners,
  normalizeMunicipalityKey,
  parseElectedStatus,
  SOLLA_CANDIDATE_NUMBER,
  UnknownMunicipalityError,
  winnerKey,
} from '@/lib/electionResults'
import { loadTseFixtureResults, TSE_FIXTURE_EXPECTED } from '../helpers/tseFixtures'

describe('electionResults municipality mapping', () => {
  it('resolves every canonical Bahia municipality through itself', () => {
    expect(bahiaMunicipalities).toHaveLength(417)
    expect(() => assertAllCanonicalMunicipalitiesResolvable()).not.toThrow()
  })

  it('maps TSE ALL-CAPS names to canonical names', () => {
    expect(canonicalizeMunicipalityName('SALVADOR')).toBe('Salvador')
    expect(canonicalizeMunicipalityName('FEIRA DE SANTANA')).toBe('Feira de Santana')
    expect(canonicalizeMunicipalityName("DIAS D'AVILA")).toBe("Dias d'Ávila")
    expect(canonicalizeMunicipalityName('XIQUE-XIQUE')).toBe('Xique-Xique')
  })

  it('maps known TSE spelling aliases to canonical names', () => {
    expect(canonicalizeMunicipalityName('CAMACÃ')).toBe('Camacan')
    expect(canonicalizeMunicipalityName('DIAS D ÁVILA')).toBe("Dias d'Ávila")
    expect(canonicalizeMunicipalityName('MUQUÉM DO SÃO FRANCISCO')).toBe(
      'Muquém de São Francisco',
    )
    expect(canonicalizeMunicipalityName('SANTA TEREZINHA')).toBe('Santa Teresinha')
  })

  it('fails closed on unknown municipality names', () => {
    expect(() => canonicalizeMunicipalityName('CIDADE INEXISTENTE')).toThrow(UnknownMunicipalityError)
  })

  it('normalizes accent and apostrophe variants to the same key', () => {
    expect(normalizeMunicipalityKey("Dias d'Ávila")).toBe(normalizeMunicipalityKey("DIAS D'AVILA"))
  })
})

describe('electionResults elected status', () => {
  it('maps DS_SIT_TOT_TURNO variants', () => {
    expect(parseElectedStatus('ELEITO')).toEqual({ elected: true, electedBy: 'QP' })
    expect(parseElectedStatus('ELEITO POR MÉDIA')).toEqual({ elected: true, electedBy: 'média' })
    expect(parseElectedStatus('ELEITO EM 2º TURNO')).toEqual({
      elected: true,
      electedBy: '2º turno',
    })
    expect(parseElectedStatus('2º TURNO')).toEqual({ elected: false, electedBy: null })
    expect(parseElectedStatus('NÃO ELEITO')).toEqual({ elected: false, electedBy: null })
    expect(parseElectedStatus('#NULO#')).toEqual({ elected: false, electedBy: null })
  })
})

describe('electionCandidateIdentity', () => {
  it('is stable for equivalent normalized inputs', () => {
    const a = computeIdentityKey({
      urnaName: 'Jorge Solla',
      birthCity: 'Salvador',
      birthState: 'BA',
      party: 'PT',
    })
    const b = computeIdentityKey({
      urnaName: 'JORGE SOLLA',
      birthCity: 'SALVADOR',
      birthState: 'ba',
      party: 'pt',
    })
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })

  it('changes when party changes', () => {
    const base = {
      urnaName: 'LULA',
      birthCity: 'GARANHUNS',
      birthState: 'PE',
      party: 'PT',
    }
    expect(computeIdentityKey(base)).not.toBe(computeIdentityKey({ ...base, party: 'PL' }))
  })

  it('strips accents in identity parts', () => {
    expect(normalizeIdentityPart('Jerônimo')).toBe('JERONIMO')
  })
})

describe('electionResults fixture parse + winners', () => {
  const built = loadTseFixtureResults()

  it('builds expected vote totals and skips zero-vote rows', () => {
    expect(built.unknownMunicipalities).toEqual([])
    expect(built.votes).toHaveLength(TSE_FIXTURE_EXPECTED.voteRowCount)
    expect(built.tallies).toHaveLength(TSE_FIXTURE_EXPECTED.tallyRowCount)

    const sollaVotes = built.votes
      .filter(
        (row) =>
          row.office === 'deputado_federal' && row.candidateNumber === SOLLA_CANDIDATE_NUMBER,
      )
      .reduce((sum, row) => sum + row.votes, 0)
    expect(sollaVotes).toBe(TSE_FIXTURE_EXPECTED.sollaVotesTotal)
  })

  it('marks Solla, Lula and Jerônimo as elected', () => {
    const solla = built.candidates.find(
      (c) => c.office === 'deputado_federal' && c.candidateNumber === SOLLA_CANDIDATE_NUMBER,
    )
    const lula = built.candidates.find(
      (c) =>
        c.office === 'presidente' &&
        c.candidateNumber === LULA_CANDIDATE_NUMBER &&
        c.turn === '2',
    )
    const jeronimo = built.candidates.find(
      (c) =>
        c.office === 'governador' &&
        c.candidateNumber === JERONIMO_CANDIDATE_NUMBER &&
        c.turn === '2',
    )

    expect(solla?.elected).toBe(true)
    expect(lula?.elected).toBe(true)
    expect(lula?.electedBy).toBe('2º turno')
    expect(jeronimo?.elected).toBe(true)
    expect(jeronimo?.electedBy).toBe('2º turno')
    expect(lula?.state).toBe('BA')
  })

  it('computes local winners per city+zone', () => {
    const winners = computeWinnersByScope(built.votes)
    const z1 = winners.get(winnerKey('38490', 1, 'deputado_federal', '1'))
    const z2 = winners.get(winnerKey('38490', 2, 'deputado_federal', '1'))
    expect(z1?.winnerCandidateNumber).toBe(
      TSE_FIXTURE_EXPECTED.federalWinnerSalvadorZ1.candidateNumber,
    )
    expect(z1?.winnerVotes).toBe(TSE_FIXTURE_EXPECTED.federalWinnerSalvadorZ1.votes)
    expect(z2?.winnerCandidateNumber).toBe(
      TSE_FIXTURE_EXPECTED.federalWinnerSalvadorZ2.candidateNumber,
    )
    expect(z2?.winnerVotes).toBe(TSE_FIXTURE_EXPECTED.federalWinnerSalvadorZ2.votes)

    const merged = mergeTallyWithWinners(built.tallies, winners)
    const federalZ1 = merged.find(
      (t) => t.office === 'deputado_federal' && t.zoneNumber === 1 && t.cityCode === '38490',
    )
    expect(federalZ1?.winnerCandidateName).toBe('JORGE SOLLA')
  })
})
