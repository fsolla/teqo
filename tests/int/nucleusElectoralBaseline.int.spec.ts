// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { BASELINE_TICKET_2022 } from '@/lib/electionResults'
import { computeGapVs2022 } from '@/lib/electionInsights'
import { loadNucleusActiveTabPageData } from '@/utilities/nucleusDetailPageData'
import { getNucleusElectoralBaseline } from '@/utilities/nucleusElectoralBaseline'
import { loadNucleusListOverviewData } from '@/utilities/nucleusListOverviewPageData'
import { parseNucleusListParams } from '@/utilities/nucleusUi'
import {
  buildImportBundles,
  importElectionBundles,
} from '@/utilities/electionResultsImport'
import { loadTseFixtureResults, TSE_FIXTURE_EXPECTED } from '../helpers/tseFixtures'
import { installCampaignFixtures } from '../helpers/campaignFixtures'

const whereContainsFieldEquals = (node: unknown, field: string, value: unknown): boolean => {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some((item) => whereContainsFieldEquals(item, field, value))

  const record = node as Record<string, unknown>
  const fieldValue = record[field]
  if (
    fieldValue &&
    typeof fieldValue === 'object' &&
    'equals' in fieldValue &&
    (fieldValue as { equals: unknown }).equals === value
  ) {
    return true
  }

  return Object.values(record).some((child) => whereContainsFieldEquals(child, field, value))
}

const whereContainsField = (node: unknown, field: string): boolean => {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some((item) => whereContainsField(item, field))

  const record = node as Record<string, unknown>
  if (field in record) return true
  return Object.values(record).some((child) => whereContainsField(child, field))
}

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

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

describe('nucleus electoral baseline (A4)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await deleteAllElectionData()
    const built = loadTseFixtureResults()
    await importElectionBundles(payload, buildImportBundles(built))
  })

  afterAll(async () => {
    await deleteAllElectionData()
  })

  it('aggregates Salvador zones for a campaign user and computes gap states', async () => {
    const fixtures = campaignFixtures()
    const user = await fixtures.createCampaignUser('geral', {
      name: fixtures.value('Baseline geral'),
      email: `${fixtures.value('baseline-geral')}@example.com`,
      password: fixtures.value('password'),
    })

    const baseline = await getNucleusElectoralBaseline(payload, user, {
      cities: ['Salvador'],
      regions: ['Metropolitano de Salvador'],
      tseZones: [1, 2],
    })

    expect(baseline).not.toBeNull()
    expect(baseline?.candidate.votes).toBe(1200 + 900)
    expect(baseline?.president).toEqual({ votes: TSE_FIXTURE_EXPECTED.lulaTurn2SalvadorZ1, turn: 2 })
    expect(baseline?.governor).toEqual({
      votes: TSE_FIXTURE_EXPECTED.jeronimoTurn2SalvadorZ1,
      turn: 2,
    })
    expect(baseline?.electorate.aptos).toBe(10000 + 9000)
    expect(baseline?.winnerFederal?.name).toBeTruthy()
    expect(baseline?.candidate.rank).toBe(1)

    expect(computeGapVs2022(baseline, null).status).toBe('noEstimate')
    expect(computeGapVs2022(baseline, 1500).status).toBe('below')
    expect(computeGapVs2022(baseline, 3000).status).toBe('above')
    expect(BASELINE_TICKET_2022.candidate.candidateNumber).toBe(1313)
  })

  it('does not fetch all federal T1 vote rows via Local API for the detail baseline', async () => {
    const fixtures = campaignFixtures()
    const user = await fixtures.createCampaignUser('geral', {
      name: fixtures.value('Baseline aggregate geral'),
      email: `${fixtures.value('baseline-aggregate-geral')}@example.com`,
      password: fixtures.value('password'),
    })

    const findSpy = vi.spyOn(payload, 'find')

    await getNucleusElectoralBaseline(payload, user, {
      cities: ['Salvador'],
      regions: ['Metropolitano de Salvador'],
      tseZones: [1, 2],
    })

    const voteFindCalls = findSpy.mock.calls.filter(
      (call) =>
        typeof call[0] === 'object' &&
        call[0] !== null &&
        (call[0] as { collection?: string }).collection === 'electionCandidateVote',
    )

    expect(voteFindCalls.length).toBeGreaterThan(0)

    for (const call of voteFindCalls) {
      const where = (call[0] as { where?: unknown }).where
      const queriesFederalTurn1 =
        whereContainsFieldEquals(where, 'office', 'deputado_federal') &&
        whereContainsFieldEquals(where, 'turn', '1')
      if (queriesFederalTurn1) {
        expect(whereContainsField(where, 'candidateNumber')).toBe(true)
      }
    }

    findSpy.mockRestore()
  })

  it('returns null without geography and loads baseline on the overview tab', async () => {
    const fixtures = campaignFixtures()
    const user = await fixtures.createCampaignUser('coordenador', {
      name: fixtures.value('Baseline coord'),
      email: `${fixtures.value('baseline-coord')}@example.com`,
      password: fixtures.value('password'),
    })

    expect(
      await getNucleusElectoralBaseline(payload, user, {
        cities: [],
        regions: [],
        tseZones: [],
      }),
    ).toBeNull()

    const nucleus = await fixtures.createNucleus({
      name: fixtures.value('Núcleo baseline detalhe'),
      regions: ['Metropolitano de Salvador'],
      cities: ['Salvador'],
      tseZones: [{ zoneNumber: 1 }],
      organizationKind: 'territorial',
      coordinators: [user.id],
    })
    await payload.update({
      collection: 'electoralNucleus',
      id: nucleus.id,
      data: { confirmedVoteEstimate: 1500 },
      depth: 0,
      overrideAccess: true,
    })

    const { resolveAccessibleNucleusContext } = await import('@/utilities/nucleusPageData')
    const context = await resolveAccessibleNucleusContext(payload, user, nucleus.slug, 'overview')
    const tabData = await loadNucleusActiveTabPageData(
      payload,
      user,
      context,
      'overview',
      {},
    )

    expect(tabData.tab).toBe('overview')
    if (tabData.tab !== 'overview') return
    expect(tabData.baseline?.candidate.votes).toBe(1200)
    expect(computeGapVs2022(tabData.baseline, 1500).status).toBe('above')
  })

  it('aggregates Baseline 2022 on the filtered list overview for leadership and staff', async () => {
    const fixtures = campaignFixtures()
    const general = await fixtures.createCampaignUser('geral', {
      name: fixtures.value('Overview baseline geral'),
      email: `${fixtures.value('overview-baseline-geral')}@example.com`,
      password: fixtures.value('password'),
    })
    const leadershipUser = await fixtures.createCampaignUser('lideranca', {
      name: fixtures.value('Overview baseline lider'),
      password: fixtures.value('password'),
    })

    const marker = fixtures.value('A4Overview')
    const above = await fixtures.createNucleus({
      name: `${marker} acima`,
      regions: ['Metropolitano de Salvador'],
      cities: ['Salvador'],
      tseZones: [{ zoneNumber: 1 }],
      organizationKind: 'territorial',
    })
    const below = await fixtures.createNucleus({
      name: `${marker} abaixo`,
      regions: ['Metropolitano de Salvador'],
      cities: ['Salvador'],
      tseZones: [{ zoneNumber: 2 }],
      organizationKind: 'territorial',
    })

    await payload.update({
      collection: 'electoralNucleus',
      id: above.id,
      data: { confirmedVoteEstimate: 2000 },
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'electoralNucleus',
      id: below.id,
      data: { confirmedVoteEstimate: 100 },
      depth: 0,
      overrideAccess: true,
    })

    const contact = await fixtures.createContact({
      name: fixtures.value('Lider overview baseline'),
      phone: leadershipUser.phone ?? fixtures.phone(),
    })
    await fixtures.createLeadership({
      contact: contact.id,
      nucleus: above.id,
      supportStatus: 'engajado',
      user: leadershipUser.id,
    })

    const filteredOverview = await loadNucleusListOverviewData(
      payload,
      general,
      parseNucleusListParams({ q: marker }),
    )

    expect(filteredOverview?.totalFiltered).toBe(2)
    expect(filteredOverview?.baseline2022).toEqual({
      // (2000 + 100) − (1200 + 900)
      gapTotal: 0,
      above: 1,
      below: 1,
    })

    const leadershipOverview = await loadNucleusListOverviewData(
      payload,
      leadershipUser,
      parseNucleusListParams({}),
    )
    expect(leadershipOverview?.baseline2022).not.toBeNull()
    expect(leadershipOverview?.totalFiltered).toBe(1)
    expect(leadershipOverview?.baseline2022?.above).toBe(1)
  })
})
