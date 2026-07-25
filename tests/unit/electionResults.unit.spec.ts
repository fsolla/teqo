// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { bahiaMunicipalities } from '@/lib/bahiaTerritories'
import { computeIdentityKey, normalizeIdentityPart } from '@/lib/electionCandidateIdentity'
import type { CandidateVoteRow, TseDetalheApuracaoRow } from '@/lib/electionResults'
import {
  assertAllCanonicalMunicipalitiesResolvable,
  BASELINE_TICKET_2022,
  canonicalizeMunicipalityName,
  computeWinnersByScope,
  mergeTallyWithWinners,
  normalizeMunicipalityKey,
  parseElectedStatus,
  UnknownMunicipalityError,
  winnerKey,
} from '@/lib/electionResults'
import { FEDERAL_ONLY_OFFICES } from '@/lib/electionResultsBuild'
import { mergeDuplicateTallyRows, mergeDuplicateVoteRows } from '@/lib/electionResultsParse'
import {
  loadTseFixtureResults,
  loadTseFixtureResultsForYear,
  TSE_FIXTURE_EXPECTED,
} from '../helpers/tseFixtures'

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
    expect(canonicalizeMunicipalityName('MUQUÉM DO SÃO FRANCISCO')).toBe('Muquém de São Francisco')
    expect(canonicalizeMunicipalityName('SANTA TEREZINHA')).toBe('Santa Teresinha')
  })

  it('fails closed on unknown municipality names', () => {
    expect(() => canonicalizeMunicipalityName('CIDADE INEXISTENTE')).toThrow(
      UnknownMunicipalityError,
    )
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
          row.office === 'deputado_federal' &&
          row.candidateNumber === BASELINE_TICKET_2022.candidate.candidateNumber,
      )
      .reduce((sum, row) => sum + row.votes, 0)
    expect(sollaVotes).toBe(TSE_FIXTURE_EXPECTED.sollaVotesTotal)
  })

  it('marks Solla, Lula and Jerônimo as elected', () => {
    const solla = built.candidates.find(
      (c) =>
        c.office === 'deputado_federal' &&
        c.candidateNumber === BASELINE_TICKET_2022.candidate.candidateNumber,
    )
    const lula = built.candidates.find(
      (c) =>
        c.office === 'presidente' &&
        c.candidateNumber === BASELINE_TICKET_2022.president.candidateNumber &&
        c.turn === '2',
    )
    const jeronimo = built.candidates.find(
      (c) =>
        c.office === 'governador' &&
        c.candidateNumber === BASELINE_TICKET_2022.governor.candidateNumber &&
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

  it('filters to federal deputy only when offices are restricted (E2 historical seed)', () => {
    const built = loadTseFixtureResultsForYear(2018, FEDERAL_ONLY_OFFICES)

    expect(built.votes.every((row) => row.office === 'deputado_federal')).toBe(true)
    expect(built.tallies.every((row) => row.office === 'deputado_federal')).toBe(true)
    expect(built.candidates.every((row) => row.office === 'deputado_federal')).toBe(true)
    expect(built.votes.every((row) => row.year === 2018)).toBe(true)
  })
})

describe('electionResults "voto em trânsito" merge (2014 presidente duplicate rows)', () => {
  const baseVote: CandidateVoteRow = {
    year: 2014,
    office: 'presidente',
    turn: '1',
    state: 'BA',
    cityCode: '99999',
    cityName: 'Feira de Santana',
    zoneNumber: 154,
    candidateNumber: 13,
    candidateName: 'DILMA',
    coalition: null,
    party: 'PT',
    voteType: 'nominal',
    votes: 100,
  }

  it('sums votes for rows sharing the same scope/zone/candidate key (the trânsito split)', () => {
    const merged = mergeDuplicateVoteRows([baseVote, { ...baseVote, votes: 40 }])

    expect(merged).toHaveLength(1)
    expect(merged[0].votes).toBe(140)
  })

  it('keeps rows with a different key separate (no false merge across zones/candidates)', () => {
    const otherZone = { ...baseVote, zoneNumber: 155, votes: 10 }
    const otherCandidate = { ...baseVote, candidateNumber: 45, votes: 20 }

    const merged = mergeDuplicateVoteRows([baseVote, otherZone, otherCandidate])

    expect(merged).toHaveLength(3)
    expect(merged.reduce((sum, row) => sum + row.votes, 0)).toBe(130)
  })

  it('is a no-op when there is nothing to merge (2018/2022 shape)', () => {
    const rows = [baseVote, { ...baseVote, zoneNumber: 1 }]
    expect(mergeDuplicateVoteRows(rows)).toEqual(rows)
  })

  const baseTally: TseDetalheApuracaoRow = {
    year: 2014,
    office: 'presidente',
    turn: '1',
    state: 'BA',
    cityCode: '99999',
    cityName: 'Feira de Santana',
    zoneNumber: 154,
    aptos: 300,
    comparecimento: 200,
    abstencoes: 100,
    votosValidos: 180,
    votosNominaisValidos: 175,
    votosLegenda: 5,
    votosBranco: 10,
    votosNulo: 10,
    votosAnulados: 0,
  }

  it('sums every count field for duplicate tally rows sharing the same scope key', () => {
    const merged = mergeDuplicateTallyRows([
      baseTally,
      {
        ...baseTally,
        aptos: 50,
        comparecimento: 40,
        abstencoes: 10,
        votosValidos: 35,
        votosNominaisValidos: 33,
        votosLegenda: 2,
        votosBranco: 3,
        votosNulo: 2,
        votosAnulados: 0,
      },
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      aptos: 350,
      comparecimento: 240,
      abstencoes: 110,
      votosValidos: 215,
      votosNominaisValidos: 208,
      votosLegenda: 7,
      votosBranco: 13,
      votosNulo: 12,
      votosAnulados: 0,
    })
  })

  it('is a no-op when zones differ', () => {
    const rows = [baseTally, { ...baseTally, zoneNumber: 155 }]
    expect(mergeDuplicateTallyRows(rows)).toEqual(rows)
  })
})
