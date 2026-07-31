// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { BASELINE_TICKET_2022, ELECTION_YEAR_2022 } from '@/lib/electionResults'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import type { ElectionCandidate } from '@/payload-types'
import config from '@/payload.config'
import {
  municipalityElectionGeography,
  type MunicipalityElectionGeography,
} from '@/utilities/municipality/municipalityElectionGeography'
import { queryMunicipalityTicketPartners } from '@/utilities/municipality/municipalityTicketPartnerData'

import {
  acquireTestDatabaseLease,
  ELECTION_COLLECTIONS_LEASE_KEY,
  type TestDatabaseLease,
} from '../helpers/testDatabaseLease'

/**
 * A6 — dobradinha opportunities loader. Election collections are test-owned in
 * the int suite (electionResultsImport wipes them), so this spec holds the
 * shared lease across the whole file. Marker candidate numbers live at
 * 900001+ — outside any real TSE number range (4–5 digits) — plus Solla's own
 * 1313, which the exclusion test must use by definition; both marker sets are
 * deleted before and after the file, so a full-seed dev database loses at
 * most those rows (the import spec already wipes everything).
 */
const MARKER_CANDIDATE_NUMBERS = [
  900001,
  900002,
  900003,
  900004,
  900005,
  900006,
  900007,
  BASELINE_TICKET_2022.candidate.candidateNumber,
]

const geographyOf = (index: number): MunicipalityElectionGeography & { cityName: string } => {
  const entry = municipalityCatalog[index]
  if (!entry) throw new Error(`municipalityCatalog[${index}] is unavailable.`)
  return { ...municipalityElectionGeography(entry), cityName: entry.name }
}

const geographyA = geographyOf(0)
const geographyB = geographyOf(1)

let payload: Payload
let lease: TestDatabaseLease

const deleteMarkerRows = async () => {
  await payload.delete({
    collection: 'electionCandidateVote',
    where: { candidateNumber: { in: MARKER_CANDIDATE_NUMBERS } },
    depth: 0,
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'electionCandidate',
    where: { candidateNumber: { in: MARKER_CANDIDATE_NUMBERS } },
    depth: 0,
    overrideAccess: true,
  })
  // Any reconciled row (sim/nao) flips the pending2026 probe statewide. The
  // int suite treats election data as disposable, so reset the flag to keep
  // the first scenario deterministic on every machine.
  await payload.update({
    collection: 'electionCandidate',
    where: { runningAgain2026: { in: ['sim', 'nao'] } },
    data: { runningAgain2026: 'desconhecido' },
    overrideAccess: true,
  })
}

type CandidateInput = {
  office: ElectionCandidate['office']
  candidateNumber: number
  urnaName: string
  party: string
  runningAgain2026: ElectionCandidate['runningAgain2026']
  elected?: boolean
}

const createCandidate = (input: CandidateInput) =>
  payload.create({
    collection: 'electionCandidate',
    data: {
      year: ELECTION_YEAR_2022,
      turn: '1',
      state: 'BA',
      coalition: null,
      elected: input.elected ?? false,
      ...input,
    },
    depth: 0,
    overrideAccess: true,
  })

const createVotes = (
  geography: MunicipalityElectionGeography & { cityName: string },
  office: ElectionCandidate['office'],
  candidateNumber: number,
  candidateName: string,
  votes: number,
) =>
  payload.create({
    collection: 'electionCandidateVote',
    data: {
      year: ELECTION_YEAR_2022,
      office,
      turn: '1',
      state: 'BA',
      cityCode: geography.cityCode,
      cityName: geography.cityName,
      zoneNumber: geography.zones[0]!,
      candidateNumber,
      candidateName,
      voteType: 'nominal',
      votes,
    },
    depth: 0,
    overrideAccess: true,
  })

describe('municipality ticket partner data (A6)', () => {
  // The lease acquisition blocks until the other election spec finishes its
  // whole file — far past the 10s default hook timeout under pool contention.
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    lease = await acquireTestDatabaseLease(payload, ELECTION_COLLECTIONS_LEASE_KEY)
    await deleteMarkerRows()
  }, 120_000)

  afterEach(async () => {
    await deleteMarkerRows()
  })

  afterAll(async () => {
    await deleteMarkerRows()
    await lease.release()
  }, 120_000)

  it('stays unavailable while 2026 is not reconciled, even with local 2022 votes', async () => {
    await createCandidate({
      office: 'deputado_federal',
      candidateNumber: 900001,
      urnaName: 'Candidato Desconhecido',
      party: 'PT',
      runningAgain2026: 'desconhecido',
    })
    await createVotes(geographyA, 'deputado_federal', 900001, 'Candidato Desconhecido', 500)

    const result = await queryMunicipalityTicketPartners(payload, geographyA)
    expect(result).toEqual({ status: 'pending2026' })
  })

  it('lists only adversaries when every returning candidate is one', async () => {
    await createCandidate({
      office: 'deputado_federal',
      candidateNumber: 900002,
      urnaName: 'Adversário Federal',
      party: 'PL',
      runningAgain2026: 'sim',
    })
    await createCandidate({
      office: 'deputado_estadual',
      candidateNumber: 900003,
      urnaName: 'Adversário Estadual',
      party: 'MDB',
      runningAgain2026: 'sim',
    })
    await createVotes(geographyA, 'deputado_federal', 900002, 'Adversário Federal', 800)
    await createVotes(geographyA, 'deputado_estadual', 900003, 'Adversário Estadual', 500)

    const result = await queryMunicipalityTicketPartners(payload, geographyA)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.opportunities.map((opportunity) => opportunity.name)).toEqual([
      'Adversário Federal',
      'Adversário Estadual',
    ])
    expect(result.opportunities.every((opportunity) => opportunity.tier === 'adversario')).toBe(
      true,
    )
    expect(result.opportunities[0]?.votes2022).toBe(800)
    expect(result.opportunities[1]?.votes2022).toBe(500)
  })

  it('ranks a mixed field, excludes Solla/nao, and ignores votes from other geographies', async () => {
    await createCandidate({
      office: 'deputado_estadual',
      candidateNumber: 900004,
      urnaName: 'Aliada Estadual',
      party: 'PT',
      runningAgain2026: 'sim',
      elected: true,
    })
    await createCandidate({
      office: 'deputado_federal',
      candidateNumber: 900005,
      urnaName: 'Histórico Federal',
      party: 'PSOL',
      runningAgain2026: 'sim',
    })
    await createCandidate({
      office: 'deputado_federal',
      candidateNumber: 900006,
      urnaName: 'Adversário Federal',
      party: 'PL',
      runningAgain2026: 'sim',
    })
    // Solla himself: reference, never a partner row.
    await createCandidate({
      office: 'deputado_federal',
      candidateNumber: BASELINE_TICKET_2022.candidate.candidateNumber,
      urnaName: 'Jorge Solla',
      party: 'PT',
      runningAgain2026: 'sim',
    })
    // Reconciled as NOT running again: excluded.
    await createCandidate({
      office: 'deputado_federal',
      candidateNumber: 900007,
      urnaName: 'Aposentado Federal',
      party: 'PV',
      runningAgain2026: 'nao',
    })

    await createVotes(geographyA, 'deputado_estadual', 900004, 'Aliada Estadual', 100)
    await createVotes(geographyB, 'deputado_estadual', 900004, 'Aliada Estadual', 500)
    await createVotes(geographyA, 'deputado_federal', 900005, 'Histórico Federal', 9000)
    await createVotes(geographyA, 'deputado_federal', 900006, 'Adversário Federal', 9000)
    await createVotes(
      geographyA,
      'deputado_federal',
      BASELINE_TICKET_2022.candidate.candidateNumber,
      'Jorge Solla',
      9999,
    )
    await createVotes(geographyA, 'deputado_federal', 900007, 'Aposentado Federal', 9999)

    const result = await queryMunicipalityTicketPartners(payload, geographyA)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return

    expect(result.opportunities.map((opportunity) => opportunity.name)).toEqual([
      'Histórico Federal',
      'Aliada Estadual',
      'Adversário Federal',
    ])
    expect(result.opportunities.map((opportunity) => opportunity.tier)).toEqual([
      'aliadoHistorico',
      'aliado',
      'adversario',
    ])
    // Geography B votes do not leak into the municipality total.
    const aliada = result.opportunities.find(
      (opportunity) => opportunity.candidateNumber === 900004,
    )
    expect(aliada?.votes2022).toBe(100)
    expect(aliada?.elected2022).toBe(true)
  })
})
