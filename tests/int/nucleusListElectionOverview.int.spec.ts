// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'

import config from '@/payload.config'
import {
  aggregateConversionBand,
  computeConversionRate,
} from '@/lib/electionInsights'
import {
  loadNucleusListElectionOverview,
  type NucleusBaseline2022OverviewInput,
} from '@/utilities/nucleusElectoralBaseline'
import {
  seedMultiYearFederalCandidateFixture,
  TSE_FIXTURE_ZONE_EXPECTED,
} from '../helpers/tseFixtures'

let payload: Payload
let generalUser: CampaignUser

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

const salvadorZ1: NucleusBaseline2022OverviewInput = {
  cities: ['Salvador'],
  regions: ['Metropolitano de Salvador'],
  tseZones: [1],
  confirmedVoteEstimate: TSE_FIXTURE_ZONE_EXPECTED.salvadorZ1.confirmedVoteEstimate,
}

const salvadorZ2: NucleusBaseline2022OverviewInput = {
  cities: ['Salvador'],
  regions: ['Metropolitano de Salvador'],
  tseZones: [2],
  confirmedVoteEstimate: TSE_FIXTURE_ZONE_EXPECTED.salvadorZ2.confirmedVoteEstimate,
}

describe('loadNucleusListElectionOverview (E7 F2)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await deleteAllElectionData()
    await seedMultiYearFederalCandidateFixture(payload)

    generalUser = await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'List election overview geral',
        role: 'geral',
        email: `list-election-overview-geral-${Date.now()}@example.com`,
        password: 'Password123!',
      },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'campaignUser',
      id: generalUser.id,
      overrideAccess: true,
    })
    await deleteAllElectionData()
  })

  const loadOverview = (nuclei: Parameters<typeof loadNucleusListElectionOverview>[2]) =>
    loadNucleusListElectionOverview(payload, generalUser, nuclei)

  it('aggregates gap and trend when nuclei have geography and confirmed estimates', async () => {
    const result = await loadOverview([salvadorZ1, salvadorZ2])

    const { salvadorZ1: z1, salvadorZ2: z2 } = TSE_FIXTURE_ZONE_EXPECTED
    expect(result.baseline2022).toEqual({
      gapTotal:
        z1.confirmedVoteEstimate +
        z2.confirmedVoteEstimate -
        (z1.sollaVotes2022 + z2.sollaVotes2022),
      above: 1,
      below: 1,
    })
    expect(result.trend?.stable).toBeGreaterThanOrEqual(2)
    expect(result.conversion).not.toBeNull()
  })

  it('returns trend without gap or conversion when estimates are absent', async () => {
    const result = await loadOverview([
      { ...salvadorZ1, confirmedVoteEstimate: null },
      { ...salvadorZ2, confirmedVoteEstimate: null },
    ])

    expect(result.baseline2022).toEqual({
      gapTotal: null,
      above: 0,
      below: 0,
    })
    expect(result.trend?.stable).toBeGreaterThanOrEqual(2)
    expect(result.conversion).toBeNull()
  })

  it('returns null aggregates when no nucleus resolves geography', async () => {
    const result = await loadOverview([
      {
        cities: [],
        regions: [],
        tseZones: [],
        confirmedVoteEstimate: 500,
      },
    ])

    expect(result).toEqual({
      baseline2022: null,
      trend: null,
      conversion: null,
      mobilization: null,
      leverage: null,
      flipOpportunity: null,
      classification: null,
    })
  })

  it('aggregates weighted conversion rate and band distribution over comparable nuclei', async () => {
    const { salvadorZ1: z1, salvadorZ2: z2 } = TSE_FIXTURE_ZONE_EXPECTED
    const result = await loadOverview([salvadorZ1, salvadorZ2])

    const aptosSum = z1.aptos + z2.aptos
    const estimateSum = z1.confirmedVoteEstimate + z2.confirmedVoteEstimate
    const expectedDistribution = aggregateConversionBand([
      computeConversionRate({
        aptos: z1.aptos,
        abstencoes: z1.abstencoes,
        confirmedVoteEstimate: z1.confirmedVoteEstimate,
      }).band,
      computeConversionRate({
        aptos: z2.aptos,
        abstencoes: z2.abstencoes,
        confirmedVoteEstimate: z2.confirmedVoteEstimate,
      }).band,
    ])

    expect(result.conversion).toEqual({
      weightedRate: Math.round((estimateSum / aptosSum) * 100),
      distribution: expectedDistribution,
    })
  })

  it('aggregates conversion from aptos and estimates when 2022 candidate votes are absent', async () => {
    const tally = await payload.create({
      collection: 'electionTally',
      data: {
        year: 2022,
        office: 'deputado_federal',
        turn: '1',
        state: 'BA',
        cityCode: '34134',
        cityName: 'Camaçari',
        zoneNumber: 170,
        aptos: 8000,
        comparecimento: 6400,
        abstencoes: 1600,
        votosValidos: 6000,
        votosNominaisValidos: 5800,
        votosLegenda: 200,
        votosBranco: 200,
        votosNulo: 200,
        votosAnulados: 0,
      },
      overrideAccess: true,
    })

    try {
      const estimate = 400
      const result = await loadOverview([
        {
          cities: ['Camaçari'],
          regions: ['Metropolitano de Salvador'],
          tseZones: [170],
          confirmedVoteEstimate: estimate,
        },
      ])

      expect(result.baseline2022).toEqual({
        gapTotal: null,
        above: 0,
        below: 0,
      })
      expect(result.conversion).toEqual({
        weightedRate: Math.round((estimate / 8000) * 100),
        distribution: { reduto: 0, consolidado: 0, oportunidade: 1 },
      })
    } finally {
      await payload.delete({
        collection: 'electionTally',
        id: tally.id,
        overrideAccess: true,
      })
    }
  })
})
