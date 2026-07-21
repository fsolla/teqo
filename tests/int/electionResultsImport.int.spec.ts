// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { BASELINE_TICKET_2022 } from '@/lib/electionResults'
import {
  buildImportBundles,
  importElectionBundles,
} from '@/utilities/electionResultsImport'
import { loadTseFixtureResults, loadTseFixtureResultsForYear, TSE_FIXTURE_EXPECTED } from '../helpers/tseFixtures'
import { FEDERAL_ONLY_OFFICES } from '@/lib/electionResultsBuild'

let payload: Payload

const deleteAllElectionData = async () => {
  for (const collection of [
    'electionCandidateVote',
    'electionTally',
    'electionCandidate',
  ] as const) {
    const existing = await payload.find({
      collection,
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    for (const doc of existing.docs) {
      await payload.delete({
        collection,
        id: doc.id,
        overrideAccess: true,
      })
    }
  }
}

describe('election results import', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await deleteAllElectionData()
  })

  afterAll(async () => {
    await deleteAllElectionData()
  })

  it('imports fixture totals, winners, elected flags, and is idempotent', async () => {
    const built = loadTseFixtureResults()
    const bundles = buildImportBundles(built)

    const first = await importElectionBundles(payload, bundles)
    const second = await importElectionBundles(payload, bundles)

    const firstVotes = first.reduce((sum, c) => sum + c.votesInserted, 0)
    const secondVotes = second.reduce((sum, c) => sum + c.votesInserted, 0)
    expect(firstVotes).toBe(TSE_FIXTURE_EXPECTED.voteRowCount)
    expect(secondVotes).toBe(firstVotes)
    expect(second.reduce((sum, c) => sum + c.votesDeleted, 0)).toBe(firstVotes)

    const votes = await payload.find({
      collection: 'electionCandidateVote',
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    expect(votes.totalDocs).toBe(TSE_FIXTURE_EXPECTED.voteRowCount)

    const sollaVotes = votes.docs
      .filter(
        (doc) =>
          doc.office === 'deputado_federal' &&
          Number(doc.candidateNumber) === BASELINE_TICKET_2022.candidate.candidateNumber,
      )
      .reduce((sum, doc) => sum + Number(doc.votes), 0)
    expect(sollaVotes).toBe(TSE_FIXTURE_EXPECTED.sollaVotesTotal)

    const tallies = await payload.find({
      collection: 'electionTally',
      where: {
        and: [
          { office: { equals: 'deputado_federal' } },
          { cityCode: { equals: '38490' } },
          { zoneNumber: { equals: 1 } },
          { turn: { equals: '1' } },
        ],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(tallies.docs[0]?.winnerCandidateNumber).toBe(
      TSE_FIXTURE_EXPECTED.federalWinnerSalvadorZ1.candidateNumber,
    )
    expect(Number(tallies.docs[0]?.winnerVotes)).toBe(
      TSE_FIXTURE_EXPECTED.federalWinnerSalvadorZ1.votes,
    )

    const candidates = await payload.find({
      collection: 'electionCandidate',
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    const solla = candidates.docs.find(
      (doc) => doc.office === 'deputado_federal' && Number(doc.candidateNumber) === 1313,
    )
    const lula = candidates.docs.find(
      (doc) =>
        doc.office === 'presidente' &&
        Number(doc.candidateNumber) === 13 &&
        doc.turn === '2',
    )
    const jeronimo = candidates.docs.find(
      (doc) =>
        doc.office === 'governador' &&
        Number(doc.candidateNumber) === 13 &&
        doc.turn === '2',
    )
    expect(solla?.elected).toBe(true)
    expect(lula?.elected).toBe(true)
    expect(jeronimo?.elected).toBe(true)
    expect(lula?.identityKey).toBeTruthy()
  })

  it('imports a historical year without removing the 2022 scope', async () => {
    const built2018 = loadTseFixtureResultsForYear(2018, FEDERAL_ONLY_OFFICES)
    await importElectionBundles(payload, buildImportBundles(built2018))

    const votes2022 = await payload.find({
      collection: 'electionCandidateVote',
      where: { year: { equals: 2022 } },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    const votes2018 = await payload.find({
      collection: 'electionCandidateVote',
      where: {
        and: [{ year: { equals: 2018 } }, { office: { equals: 'deputado_federal' } }],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    const president2018 = await payload.find({
      collection: 'electionCandidateVote',
      where: {
        and: [{ year: { equals: 2018 } }, { office: { equals: 'presidente' } }],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })

    expect(votes2022.totalDocs).toBe(TSE_FIXTURE_EXPECTED.voteRowCount)
    expect(votes2018.totalDocs).toBeGreaterThan(0)
    expect(president2018.totalDocs).toBe(0)
  })

  it('allows campaignUser read and denies campaignUser mutation', async () => {
    // Avoid campaignFixtures here: teqo_test may already include territory migrations
    // from other worktrees that diverge from this branch's electoralNucleus schema.
    const campaignUser = await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Election Access Tester',
        role: 'coordinator',
        email: `election-access-${Date.now()}@example.com`,
        password: 'Password123!',
      },
      overrideAccess: true,
    })

    try {
      const readable = await payload.find({
        collection: 'electionTally',
        depth: 0,
        limit: 1,
        user: campaignUser,
        overrideAccess: false,
      })
      expect(readable.totalDocs).toBeGreaterThan(0)

      await expect(
        payload.create({
          collection: 'electionTally',
          data: {
            year: 2022,
            office: 'deputado_federal',
            turn: '1',
            state: 'BA',
            cityCode: '99999',
            cityName: 'Salvador',
            zoneNumber: 99,
            aptos: 1,
            comparecimento: 1,
            abstencoes: 0,
            votosValidos: 1,
            votosNominaisValidos: 1,
            votosLegenda: 0,
            votosBranco: 0,
            votosNulo: 0,
            votosAnulados: 0,
          },
          user: campaignUser,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    } finally {
      await payload.delete({
        collection: 'campaignUser',
        id: campaignUser.id,
        overrideAccess: true,
      })
    }
  })
})
