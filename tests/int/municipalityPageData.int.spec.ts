// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadMunicipalityListPageBundle } from '@/utilities/municipalityPageData'
import {
  aggregatePledgesByMunicipality,
  rollupMunicipalityStaffVotes,
} from '@/utilities/votePledgeData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('loadMunicipalityListPageBundle', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns null overview when the filtered municipality set is empty', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    const bundle = await loadMunicipalityListPageBundle(payload, coordinator, { q: 'zzznomatch' })

    expect(bundle.municipalities).toHaveLength(0)
    expect(bundle.overview).toBeNull()
  })

  it('rolls up staffVoteTotal from expectedVotes when no pledge overrides apply', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    fixtures.touchMunicipality(municipality.id)

    await payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { expectedVotes: { pessimistic: null, central: 1_500, optimistic: null } },
      depth: 0,
      overrideAccess: true,
    })

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'engajado',
    })
    await fixtures.createVotePledge({
      leadership: leadership.id,
      municipality: municipality.id,
      declaredVotes: 80,
      estimatedVotes: { pessimistic: null, central: 120, optimistic: null },
    })

    const refreshedMunicipality = await payload.findByID({
      collection: 'municipality',
      id: municipality.id,
      depth: 0,
      overrideAccess: true,
    })
    const aggregates = await aggregatePledgesByMunicipality(payload, [municipality.id])
    const rollup = rollupMunicipalityStaffVotes([refreshedMunicipality], aggregates)
    expect(rollup.staffVoteTotal).toBe(1_500)

    const bundle = await loadMunicipalityListPageBundle(payload, coordinator, {
      q: municipality.name,
    })

    expect(bundle.overview).not.toBeNull()
    expect(bundle.overview!.staffVoteTotalByScenario.central).toBeGreaterThanOrEqual(1_500)
    const row = bundle.municipalities.find((item) => item.slug === municipality.slug)
    expect(row?.votePosition2022).not.toBeNull()
    expect(row!.votePosition2022!.totalUnits).toBe(435)
    expect(row!.votePosition2022!.rank).toBeGreaterThanOrEqual(1)
  })

  it('orders the filtered set by 2022 votes when sort=votos', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const first = await fixtures.getMunicipality()
    const second = await fixtures.getMunicipality()
    fixtures.touchMunicipality(first.id)
    fixtures.touchMunicipality(second.id)

    const marker = `a11-votos-${Date.now()}`
    await payload.update({
      collection: 'municipality',
      id: first.id,
      data: { name: `${marker}-alpha` },
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'municipality',
      id: second.id,
      data: { name: `${marker}-beta` },
      depth: 0,
      overrideAccess: true,
    })

    const bundle = await loadMunicipalityListPageBundle(payload, coordinator, {
      q: marker,
      sort: 'votos',
    })

    expect(bundle.municipalities.length).toBeGreaterThanOrEqual(2)
    const votes = bundle.municipalities.map((row) => row.votePosition2022?.votes ?? 0)
    const nonZero = votes.filter((value) => value > 0)
    for (let index = 1; index < nonZero.length; index += 1) {
      expect(nonZero[index - 1]!).toBeGreaterThanOrEqual(nonZero[index]!)
    }
    // Zeros (if any) must trail the non-zero block.
    const firstZero = votes.findIndex((value) => value === 0)
    if (firstZero >= 0) {
      expect(votes.slice(firstZero).every((value) => value === 0)).toBe(true)
    }
  })

  it('keeps advisor access and applies URL filters on top', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const included = await loadMunicipalityListPageBundle(payload, advisor, {
      q: administered.name,
    })
    expect(included.overview).not.toBeNull()
    expect(included.municipalities.some((row) => row.slug === administered.slug)).toBe(true)

    const excluded =
      administered.kind === 'zona'
        ? await loadMunicipalityListPageBundle(payload, advisor, { kind: 'municipio' })
        : await loadMunicipalityListPageBundle(payload, advisor, { kind: 'zona' })
    expect(excluded.overview).toBeNull()
    expect(excluded.municipalities).toHaveLength(0)
  })

  it('returns an empty bundle for leaders (municipality list lockdown)', async () => {
    const fixtures = campaignFixtures()
    const municipality = await fixtures.getMunicipality()
    const leader = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      user: leader.id,
      supportStatus: 'engajado',
    })

    const bundle = await loadMunicipalityListPageBundle(payload, leader, { q: municipality.name })

    expect(bundle.overview).toBeNull()
    expect(bundle.municipalities).toHaveLength(0)
    expect(bundle.scopeTotal).toBe(0)
  })
})
